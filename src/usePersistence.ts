/* usePersistence.ts — ROUND BN-2: the save/load cluster moved out of App()
 *  verbatim (saveState, the AT-1 storage-mode + AT-4 quota readouts, the
 *  PACKAGE-S dirty marker, flushSave with its AS-5 save gate + AUDIT-8b retry,
 *  the debounced autosave effect, and the first-boot last-board bootstrap with
 *  its StrictMode double-mount guard). Behaviour-neutral: bodies are
 *  byte-identical; only this wrapper, its parameter list and the return tuple
 *  are new. applyBoard STAYS in App() (it owns the module-level idc bump and
 *  the undo/selection reset) and is passed in; nodes/edges and the board
 *  doc state stay in App and pass down positionally — no context.  (feature-map home: src/src/usePersistence.ts)
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type * as React from 'react';
import type {Edge, Node} from '@xyflow/react';
import * as boards from './boards';
import type {BoardDoc, BoardMeta} from './boards';
import {isQuotaError, QUOTA_MESSAGE, isVolatile} from './localStore';
import {initialNodes, initialEdges} from './boardConstants';
import type {PresetId} from './presets';

/* Positional parameters, not an opts object: the bundle ratchet is raw bytes
   and object property names survive minification (AGENTS.md perf ratchet). */
export function usePersistence(
  nodes: Node[],
  edges: Edge[],
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>,
  curBoard: BoardDoc | null,
  presetId: PresetId,
  mode: string,
  autosave: boolean,
  boardLoaded: boolean,
  setBoardLoaded: (b: boolean) => void,
  boardLoadedDocId: string | null,
  setBoardList: React.Dispatch<React.SetStateAction<BoardMeta[]>>,
  flash: (msg: string) => void,
  applyBoard: (doc: BoardDoc) => void,
) {

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /* AT-1 — the storage-mode readout for the boards popup header. Resolved from
     the same memoised boot probe the data layer uses (boards.storageModeLabel);
     refreshed when the popup opens, so it can never contradict the backend a
     save just went to. */
  const [modeLabel, setModeLabel] = useState('');
  /* AT-4 #2 — the storage readout: "X MB used of ~Y MB — persistent | best-
     effort" sentence. Local mode only (in server mode the browser's quota is
     not where the boards live, so an estimate would be a non-sequitur). */
  const [storageEstimate, setStorageEstimate] = useState('');
  const [localMode, setLocalMode] = useState(false);
  /* PACKAGE-S §S-3 — with autosave OFF this flips true on the first unflushed
     change and false on flush; with autosave ON it is always false (never shown). */
  const [dirty, setDirty] = useState(false);
  /** Mirror of curBoard for save paths (I6): flushSave reads through this ref
   *  so it does not need curBoard in its dependency array. */
  const curBoardRef = useRef<BoardDoc | null>(curBoard);
  curBoardRef.current = curBoard;
  const saveTimer = useRef<number | undefined>(undefined);
  const saveSeq = useRef(0);
  /** Set by applyBoard; the next autosave effect run(s) are skipped so
   *  loading a board doesn't immediately write it back to disk. */
  const skipAutosave = useRef(0);

  /* AS-5 — THE SAVE GATE, stated once and named. A save (debounced autosave
     scheduled, or a flush writing) runs only when BOTH hold:
       (a) a board document has been LOADED — `boardLoaded` is the loader's
           explicit flag (first boot with no last-board keeps it false until
           the bootstrap resolves one way or the other; a failed load re-arms
           nothing), and
       (b) the id the LOADER applied (`boardLoadedDocId`, set by applyBoard
           and cleared on board switch) EQUALS the id of the doc currently in
           memory (`curBoardRef`) — so a flush landing while the next board is
           still loading, a debounce firing mid-load, or any stale-doc window
           writes nothing.
     This replaces the old implicit `boardId`/`skipAutosave` combination.
     HARDENING, not a fix for a proven race: the 2026-10-19 data-loss incident
     is UNDETERMINED (see ROUND-AS-SPEC Amendment 1); this gate removes the
     unproven candidates' shared precondition — a save running when the
     in-memory doc is not the loaded doc. */
  const canAutosave = boardLoaded && boardLoadedDocId !== null && boardLoadedDocId === curBoardRef.current?.id;

  /* AS-4 — the board list refresher, declared BEFORE flushSave so the 404
     branch can call it (and name it in deps) without a TDZ ordering problem. */
  const refreshBoards = useCallback(async () => {
    try {
      setBoardList(await boards.listBoards());
    } catch (err) {
      flash(`Boards API error: ${err?.message ?? 'unknown'}`);
    }
    /* AT-1 — keep the mode line in step with the backend the list came from. */
    boards.storageModeLabel().then(label => {
      setModeLabel(label);
      /* AT-4 #2 — the estimate readout exists only for local mode. */
      const isLocal = label === 'Saved in this browser';
      setLocalMode(isLocal);
      if (isLocal) {
        void navigator?.storage?.estimate?.().then(est => {
          const used = est.usage != null ? (est.usage / (1024 * 1024)).toFixed(1) : '?';
          const quota = est.quota != null ? `~${Math.round(est.quota / (1024 * 1024))}` : '?';
          void navigator?.storage?.persisted?.().then(persisted => {
            setStorageEstimate(`${used} MB used of ${quota} MB — ${persisted
              ? 'Storage is persistent'
              : 'Best-effort storage — the browser may clear it under disk pressure. Export JSON to keep a durable copy.'}`);
          }).catch(() => { /* no readout rather than a wrong one */ });
        }).catch(() => { /* ditto */ });
      } else {
        setStorageEstimate('');
      }
    }).catch(() => { /* line stays as-is */ });
    /* AT-2 — the volatile last resort: IndexedDB itself unavailable (storage
       disabled). One-time flash; the board list still renders.
       ROUND BJ: was a dead dynamic import (localStore is also statically
       imported — vite warned); the flag is a live module binding, read
       directly. Zero behavior change. */
    if (isVolatile) flash('Browser storage is unavailable — boards will not survive a reload. Export JSON to keep your work.');
  }, [flash]);

  const flushSave = useCallback(async () => {
    setDirty(false); /* PACKAGE-S §S-3 */
    const board = curBoardRef.current;
    /* AS-5 — the explicit save gate: no write unless a board doc is LOADED and
       its id matches the in-memory doc. (The old guard was just `!board`.) */
    if (!canAutosave || !board) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const seq = ++saveSeq.current;
    setSaveState('saving');
    /* AUDIT-8b — retry with backoff: the dev server can blip (restart, network)
       mid-edit; a transient fetch failure used to surface as "save failed" and
       stayed failed. Two retries (1s, 3s) absorb a blip; a persistent failure
       still surfaces. Each attempt rebuilds the payload from the REFS so the
       retry carries the user's LATEST work, not a stale copy. */
    const payload = () => ({
      id: board.id, name: board.name,
      nodes: nodesRef.current.map(n => ({...n, selected: false})),
      /* AUDIT-8 — copy edge `data` one level, matching the node branch above.
     Every current edge writer replaces `data` wholesale, so the alias was
     harmless; the copy makes that invariant ENFORCED rather than implicit —
     a future in-place patch of edge.data can no longer rewrite history. */
      edges: edgesRef.current.map(e => ({...e, data: {...(e.data as any)}, selected: false})),
      preset: presetId,
      // The `legend` key is PERSISTED data (`BoardDoc.legend`) even though the
      // on-canvas renderer is gone: it is written back from the loaded doc so a
      // board that carries the key still round-trips instead of losing it.
      legend: board.legend,
    });
    let saved: Awaited<ReturnType<typeof boards.saveBoard>> | undefined;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          saved = await boards.saveBoard(payload());
          break;
        } catch (err) {
          /* AS-4 — a 4xx is FINAL: a deleted board is not transient, so no
             retry (the old loop would burn 1s+3s re-PUTting a corpse and the
             old server would have resurrected it). Only transient failures
             (network blips, 5xx) get the backoff. */
          const status = (err as Error & {status?: number})?.status;
          if (status !== undefined && status >= 400 && status < 500) throw err;
          if (attempt >= 2 || seq !== saveSeq.current) throw err;
          await new Promise(r => setTimeout(r, attempt === 0 ? 1000 : 3000));
        }
      }
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      // I6: do NOT setCurBoard here from the autosave path — writing updatedAt
      // back into state re-created flushSave and re-ran the autosave effect,
      // causing a ~30-PUTs-in-25s loop. Keep the local copy in sync via the
      // ref instead (no re-render, no effect re-run).
      curBoardRef.current = {...board, name: saved.name, updatedAt: saved.updatedAt};
      setSaveState('saved');
      setBoardList(l => l.map(b => b.id === saved.id
        ? {...b, updatedAt: saved.updatedAt, nodeCount: saved.nodes.length, edgeCount: saved.edges.length}
        : b));
      window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) {
      setSaveState('error');
      /* AT-4 #3 — quota is NOT transient and not a 4xx: the adapter tags it,
         and the flash names the remedy instead of retrying into a full disk. */
      if (isQuotaError(err)) {
        flash(QUOTA_MESSAGE);
      } else {
        /* AS-4 — name the deleted-board case: a 404 means the board is gone
           (deleted here or in another tab). The tab keeps its pixels (the
           user can still export), but the write is final and the board list
           is refreshed so it stops offering the corpse. */
        const status = (err as Error & {status?: number})?.status;
        if (status === 404) {
          flash('Save failed: this board was deleted');
          void refreshBoards();
        } else {
          flash(`Save failed: ${err?.message ?? 'unknown error'}`);
        }
      }
    }
  }, [flash, presetId, mode, refreshBoards, canAutosave]);

  // Debounced autosave whenever nodes/edges change (and a board is loaded).
  // I6: depend only on the board id (via ref) + nodes/edges so the effect does
  // not re-run when the board doc object changes; and only show "saving" when
  // the debounced save actually fires, not on every keystroke/drag tick.
  const boardId = curBoard?.id;
  useEffect(() => {
    /* AS-5 — the explicit save gate REPLACES the old bare `if (!boardId)`
       check: nothing is scheduled unless a doc is LOADED and the loaded id
       matches the in-memory doc (a debounce firing during a board switch or
       mid-load used to pass the old check and write the WRONG — or empty —
       graph to the PREVIOUS board's file). */
    if (!canAutosave) return;
    /* PACKAGE-S §S-3 — autosave OFF: nothing is scheduled; the change is DIRTY
       until Save / Cmd+S flushes. The dirty marker is the only signal. */
    if (!autosave) {
      setDirty(true);
      return;
    }
    setDirty(false);
    if (skipAutosave.current > 0) {
      skipAutosave.current -= 1;
      return;
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushSave(); }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [nodes, edges, boardId, flushSave, autosave, canAutosave]);

  // First load: open the last board, or the newest, or seed one from the
  // current in-memory starter diagram. Guarded against StrictMode's
  // double-mounted effect so we never seed two boards.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        let list = await boards.listBoards();
        let target: BoardDoc | null = null;
        const lastId = boards.lastBoardId();
        if (list.length === 0) {
          const doc = await boards.createBoard('My first board');
          target = {...doc, nodes: initialNodes, edges: initialEdges};
          try {
            const saved = await boards.saveBoard({id: doc.id, name: doc.name, nodes: initialNodes, edges: initialEdges});
            target = {...target, updatedAt: saved.updatedAt};
          } catch { /* keep in-memory copy */ }
          list = await boards.listBoards();
        } else {
          const want = list.find(b => b.id === lastId) ?? list[0];
          target = await boards.getBoard(want.id).catch(async (e) => {
            // stale/missing last-open board — fall back to the newest board
            if (list.length > 1) return boards.getBoard(list[0].id);
            throw e;
          });
        }
        if (!target) return;
        setBoardList(list);
        applyBoard(target);
      } catch (err) {
        // The load failed (no boards API, bad payload). There is no board to
        // render, so release the canvas: `boardLoaded` lets the empty-state panel
        // back in, which is the honest thing to show for a canvas with no board.
        flash(`Boards API error: ${err?.message ?? 'unknown'}`);
      } finally {
        // ITEM 2 — the FIRST time the canvas is handed to the user, by every
        // exit path (loaded / failed / no target). Before this, the canvas is
        // deliberately empty and silent rather than showing a seed that is about
        // to be replaced.
        setBoardLoaded(true);
      }
    })();
  }, []);

  return [saveState, modeLabel, storageEstimate, localMode, dirty,
    flushSave, refreshBoards, saveTimer, skipAutosave] as const;
}
