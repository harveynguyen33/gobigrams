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
import {type PresetId} from './presets';

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
  preset?: PresetId; legend?: boolean;
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
}) => req<ServerBoardDoc>(`/api/boards/${doc.id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(doc)});

export const deleteBoardServer = (id: string) => req<{ok: boolean}>(`/api/boards/${id}`, {method: 'DELETE'});
