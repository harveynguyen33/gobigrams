import type {Node, Edge} from '@xyflow/react';
import {type PresetId, type TemplateSpec, getPreset, asPreset} from './presets';
import {type ThemeName} from './theme';

export type BoardMeta = {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
  edgeCount: number;
  /** L2: the board's diagram type, surfaced in the board list badge. */
  preset?: PresetId;
};

export type BoardDoc = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: number;
  /** L2 — the board's diagram type. Absent on old boards → 'architecture'. */
  preset?: PresetId;
  /** PACKAGE-M fix — boards no longer store a theme. A preset may suggest one
   *  (and the user's global preference still wins); this field is LEGACY/IGNORED
   *  and kept only so old board files on disk still parse. */
  /** @deprecated (PACKAGE-M fix) — boards no longer store a theme; the preset suggests it and the
   *  user's global preference wins. Kept only so old files still parse. */
  theme?: ThemeName;
  /** L2 — the on-canvas legend/key toggle this used to control was removed on
   *  2026-09-17 (harvey: not wanted). The KEY IS PERSISTED DATA: nothing renders
   *  it, but `saveBoard` writes the value back unchanged, so a board that carries
   *  it round-trips instead of losing a key this type still declares. */
  legend?: boolean;
};

const LAST_KEY = 'diagram-studio:last-board';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const listBoards = () => req<BoardMeta[]>('/api/boards');
export const getBoard = (id: string) => req<BoardDoc>(`/api/boards/${id}`);
export const createBoard = (name: string) =>
  req<BoardDoc>('/api/boards', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name})});

/** The saved document. `preset` / `legend` are board metadata and ride along
 *  unchanged — the boards API persists arbitrary JSON, so no backend edit.
 *  `theme` is LEGACY/IGNORED (PACKAGE-M fix): boards no longer store a theme,
 *  and the API no longer writes it. The param stays optional so old callers and
 *  old files still type-check; nothing reads the value back. */
export const saveBoard = (doc: {
  id: string; name: string; nodes: Node[]; edges: Edge[];
  preset?: PresetId; /** @deprecated (PACKAGE-M fix) — ignored; boards no longer store a theme. */ theme?: ThemeName; legend?: boolean;
}) => req<BoardDoc>(`/api/boards/${doc.id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(doc)});

export const deleteBoard = (id: string) => req<{ok: boolean}>(`/api/boards/${id}`, {method: 'DELETE'});

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

export {asPreset};
