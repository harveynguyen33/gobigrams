/**
 * ROUND AT — AT-2: the SERVER half of the boards/library data layer.
 *
 * This is today's `req()`-based transport, MOVED VERBATIM out of
 * `src/boards.ts` / `src/library.ts` so `boards.ts` can become the mode
 * selector that delegates to either this module or `src/localStore.ts`
 * (IndexedDB). Nothing here changed semantically: same URLs, same method,
 * same error shape (`err.status` after AS-4 — flushSave's no-retry-on-4xx
 * logic keeps working unchanged), same `BoardMeta[]`/`BoardDoc` contracts.
 *
 * In dev (and `vite preview` after AS-4) the probe answers SERVER and every
 * byte of `vite.config.ts` behaviour is untouched (AT-6): this module is the
 * same HTTP client that always existed, in its own file so both backends sit
 * behind one seam.
 */
import type {Node, Edge} from '@xyflow/react';
import {type PresetId} from '../presets';
import {type TableStyle, type Density} from '../../packages/gobi/src/model/tableStyle';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    /* AS-4 — the status rides on the error: flushSave must NOT retry a 4xx
       (a deleted board is not transient; retrying just burns 1s+3s before the
       same failure) and must be able to name the 404 case to the user. */
    const err = new Error((data as any)?.error ?? `HTTP ${res.status}`) as Error & {status?: number};
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export type ServerBoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[]; updatedAt: number;
  preset?: PresetId; legend?: boolean; style?: TableStyle; density?: Density;
};

export const listBoardsServer = () => req<{id: string; name: string; updatedAt: number; nodeCount: number; edgeCount: number; preset?: PresetId}[]>('/api/boards');
export const getBoardServer = (id: string) => req<ServerBoardDoc>(`/api/boards/${id}`);
export const createBoardServer = (name: string) =>
  req<ServerBoardDoc>('/api/boards', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})});

/** The saved document. `preset` / `legend` are board metadata and ride along
 *  unchanged — the boards API persists arbitrary JSON, so no backend edit.
 *  `theme` is LEGACY/IGNORED (PACKAGE-M fix): boards no longer store a theme,
 *  and the API no longer writes it. The param stays optional so old callers and
 *  old files still type-check; nothing reads the value back. */
export const saveBoardServer = (doc: {
  id: string; name: string; nodes: Node[]; edges: Edge[];
  preset?: PresetId; /** @deprecated (PACKAGE-M fix) — ignored; boards no longer store a theme. */ theme?: string; legend?: boolean;
  /** BOARD-STYLE (2026-11-09) — carried verbatim; absent stays absent. */
  style?: TableStyle; density?: Density;
}) => req<ServerBoardDoc>(`/api/boards/${doc.id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(doc)});

export const deleteBoardServer = (id: string) => req<{ok: boolean}>(`/api/boards/${id}`, {method: 'DELETE'});

/* HISTORY-V2 (t_ed1282a5) — the READ half of the save history over the same
 *  transport. One row per stored generation, NEWEST FIRST; the row shape is
 *  the seam's contract, identical across storage modes (V4 owns the local
 *  versions store that will produce the same shape). */
export type HistoryRow = {
  /** 13-digit epoch-ms stamp — the generation file name's own digits. */
  stamp: string;
  /** The same instant as a number (the listing's sort key). */
  at: number;
  /** The generation file's size on disk. */
  bytes: number;
  /** Sidecar decoration (V3 writes the sidecar); absent on plain stamps. */
  label?: string;
  source?: string;
};
export const listHistoryServer = (id: string) => req<HistoryRow[]>(`/api/boards/${id}/history`);
export const getHistoryVersionServer = (id: string, stamp: string) =>
  req<ServerBoardDoc>(`/api/boards/${id}/history/${stamp}`);

/* HISTORY-V3 (t_37f23a89) — the pins sidecar's WRITE half over the same
 *  transport. The server owns every guard (the 13-digit stamp, the ≤80-char
 *  label, the 4-pin cap → 409 with the count); the READ routes' row shape is
 *  untouched — a pin only DECORATES a row the listing already produced. */
export const pinHistoryLabelServer = (id: string, stamp: string, label: string) =>
  req<{ok: boolean; pinned: number}>(`/api/boards/${id}/history/${stamp}/label`,
    {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({label})});
export const unpinHistoryLabelServer = (id: string, stamp: string) =>
  req<{ok: boolean; pinned: number}>(`/api/boards/${id}/history/${stamp}/label`, {method: 'DELETE'});
