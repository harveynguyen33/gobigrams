/* useShareView.ts — ROUND GOBI-S1: the share-link VIEW ROUTE. On load, a
 * `#b=<payload>` fragment owns the canvas: the board is decoded from the URL
 * (never a server), rendered READ-ONLY, with no autosave — a shared link must
 * never write to the visitor's boards. "Edit a copy" clones it into a normal
 * editable board with ONE undo entry back to the shared view, and strips the
 * fragment so a reload does not re-enter read-only. (feature-map home: src/useShareView.ts)
 *
 * The codec arrives by DYNAMIC import (the round-bn2 lazy law): nothing about
 * sharing costs the boot path until a link is actually opened.
 *
 * Save-gate interplay (AS-5): the shared doc is applied WITHOUT setting
 * `boardLoadedDocId`, so `canAutosave` stays false for the whole read-only
 * view — the debounced effect schedules nothing and every flushSave caller
 * (board switches, "Save now") writes nothing. The visitor's boards are
 * untouched; "Edit a copy" is the one exit, and it arms the gate for the NEW
 * board's id only. */
import {useCallback, useEffect, useRef, useState} from 'react';
import type * as React from 'react';
import type {Edge, Node} from '@xyflow/react';
import type {BoardDoc} from './boards';
import * as boards from './boards';
import {migrateDoc} from './boardMigrations';

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;

/** The fragment key a shared link uses (mirrors src/share's SHARE_KEY). */
const SHARE_FRAGMENT = '#b=';

/** Read the share payload off the current URL, once. Null when absent. */
export function shareViewPayload(): string | null {
  try {
    const h = location.hash;
    return h.startsWith(SHARE_FRAGMENT) ? decodeURIComponent(h.slice(SHARE_FRAGMENT.length)) : null;
  } catch { return null; }
}

/** Strip the fragment in-place: a reload must not re-enter the read-only view. */
const stripFragment = () => {
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
};

export function useShareView(
  setNodes: SetNodes,
  setEdges: SetEdges,
  setCurBoard: React.Dispatch<React.SetStateAction<BoardDoc | null>>,
  setBoardList: React.Dispatch<React.SetStateAction<{id: string; name: string; updatedAt: number; nodeCount: number; edgeCount: number; preset?: string}[]>>,
  setBoardLoadedDocId: (id: string | null) => void,
  adoptBoardPreset: (doc: BoardDoc) => void,
  setReadOnly: (v: boolean) => void,
  readOnlyRef: React.MutableRefObject<boolean>,
  pushHistory: () => void,
  fitView: () => void,
  flash: (msg: string) => void,
  /** App-held mirror of "a fragment owned the boot"; usePersistence reads it
   *  to skip the last-board bootstrap entirely while a share view is active. */
  shareActive: React.MutableRefObject<boolean>,
) {
  const [shareDoc, setShareDoc] = useState<BoardDoc | null>(null);
  /** The decode failed: a plain reason string for the error card. */
  const [shareError, setShareError] = useState<string | null>(null);
  /** The app's canonical home (for "Open in Gobigrams"), read from the codec
   *  module at decode time so the prod-host constant stays in ONE place. */
  const [shareHome, setShareHome] = useState('');

  useEffect(() => {
    const payload = shareViewPayload();
    if (!payload) return;
    let alive = true;
    (async () => {
      const mod = await import('./share');
      if (!alive) return;
      setShareHome(mod.SHARE_BASE_URL);
      /* The view route decodes through the SAME decoder every door uses —
         never its own parser (harness S5f). A refusal is an error card, not
         a throw and not a blank canvas. */
      const res = await mod.decodeShare(payload);
      if (!alive) return;
      if (res.ok === false) { setShareError(res.reason); return; }
      const doc = migrateDoc(res.board);
      setShareDoc(doc);
      /* READ-ONLY: review mode's own props/class gating (nodesDraggable,
         panOnDrag, handle reveal…) ride the existing `readOnly` state. The
         preference key is NOT written — this is the link's mode, not the
         user's; "Edit a copy" turns it off. */
      setReadOnly(true);
      readOnlyRef.current = true;
      setNodes(doc.nodes.map(n => ({...n, selected: false})));
      setEdges(doc.edges.map(e => ({...e, selected: false})));
      setCurBoard(doc);
      /* The save gate stays CLOSED (no setBoardLoadedDocId): nothing the
         visitor does in this view may reach any board file. */
    })();
    return () => { alive = false; };
  }, []);

  /** "Edit a copy": the ONE exit. Creates a real board holding the shared
   *  content, applies it with ONE undo entry (pushHistory records the shared
   *  view first — undo returns to it, the same contract as the JSON-import
   *  path), arms the save gate for the copy's id only, strips the fragment,
   *  and leaves review mode. */
  const editCopy = useCallback(async () => {
    if (!shareDoc) return;
    try {
      const name = shareDoc.name || 'Shared copy';
      const created = await boards.createBoard(name);
      const saved = await boards.saveBoard({
        id: created.id, name,
        nodes: shareDoc.nodes.map(n => ({...n, selected: false})),
        edges: shareDoc.edges.map((e: Edge) => ({...e, data: {...e.data}, selected: false})),
        preset: shareDoc.preset,
      });
      pushHistory();
      setNodes(saved.nodes.map(n => ({...n, selected: false})));
      setEdges(saved.edges.map(e => ({...e, selected: false})));
      adoptBoardPreset(saved);
      setCurBoard(saved);
      setBoardLoadedDocId(saved.id);
      boards.cacheLastBoard(saved.id);
      setBoardList(await boards.listBoards());
      setShareDoc(null);
      shareActive.current = false;
      setReadOnly(false);
      readOnlyRef.current = false;
      stripFragment();
      flash(`Saved an editable copy — “${name}”`);
      setTimeout(fitView, 60);
    } catch (err) {
      flash(`Could not save a copy: ${(err as Error)?.message ?? 'unknown error'}`);
    }
  }, [shareDoc, setNodes, setEdges, setCurBoard, setBoardList, setBoardLoadedDocId,
    adoptBoardPreset, setReadOnly, readOnlyRef, pushHistory, fitView, flash, shareActive]);

  /** A broken link is dismissible: reload at the stripped URL so the visitor
   *  lands in the normal app (the bootstrap was skipped for the share boot,
   *  so a live re-bootstrap is a reload, not a state patch). */
  const dismissError = useCallback(() => {
    stripFragment();
    location.assign(location.pathname + location.search);
  }, []);

  return {shareDoc, shareError, shareHome, editCopy, dismissError} as const;
}
