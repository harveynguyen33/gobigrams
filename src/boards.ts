import type {Node, Edge} from '@xyflow/react';
import {type PresetId, type TemplateSpec, getPreset, asPreset} from './presets';
import {type ThemeName} from './theme';

/* ===========================================================================
   AT-1 — THE BOOT PROBE.
   =========================================================================== */

/** Probe outcome for the boards backend (AT-1). 'server' = the /api/boards
 *  JSON API answered; 'local' = this browser owns the boards (IndexedDB). */
export type StorageMode = 'server' | 'local';

/** Timeout for the boot probe. ~3× a LAN round-trip and well under the
 *  800 ms autosave's human timescale: a hung connection must never hang boot. */
export const PROBE_TIMEOUT = 2500;

/** The boot probe (AT-1). Injected `fetch` (defaults to the global) keeps it
 *  DOM-free-testable: checks/round-at-local-store.mjs drives all six rows of
 *  the decision table in Node.
 *
 *  SERVER only when the answer is PROOF our API replied: ok + JSON content-
 *  type + an Array body (`listBoards()` returns BoardMeta[] and nothing else
 *  on this origin ever will). Any other outcome — SPA-fallback HTML on a
 *  static host (measured: `vite preview` answers 200 text/html), a 404/5xx,
 *  non-array JSON, a network rejection (`file://` origin), a hung connection
 *  — converges on LOCAL. The user never sees a broken board list. */
export async function decideStorageMode(
  fetchImpl: typeof fetch = fetch,
): Promise<StorageMode> {
  try {
    const ctrl = new AbortController();
    /* The deadline REJECTS (and aborts) — racing it against the fetch means a
       connection that never answers (and a stub that ignores the signal)
       still converges on LOCAL at PROBE_TIMEOUT instead of hanging boot. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, PROBE_TIMEOUT);
    });
    let res: Response;
    try {
      res = await Promise.race([fetchImpl('/api/boards', {signal: ctrl.signal}), deadline]);
    } finally {
      clearTimeout(timer);
    }
    if (!(res && res.ok && /json/i.test(res.headers?.get?.('content-type') ?? ''))) return 'local';
    const body: unknown = await res.json();
    return Array.isArray(body) ? 'server' : 'local';
  } catch {
    return 'local';
  }
}

/* The session-wide decision. First call runs the probe; every later call
   awaits the SAME promise — one probe, one mode, for the whole session
   (AT-1: no mid-session flipping; a board saved mid-session goes to the
   mode chosen at boot). */
let modePromise: Promise<StorageMode> | null = null;
export function probeServerModeOnce(fetchImpl?: typeof fetch): Promise<StorageMode> {
  modePromise ??= decideStorageMode(fetchImpl);
  return modePromise;
}

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
