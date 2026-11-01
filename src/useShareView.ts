/* useShareView.ts — ROUND GOBI-S1: the share-link VIEW ROUTE. On load, a
 * `#b=<payload>` fragment owns the canvas: the board is decoded from the URL
 * (never a server), rendered READ-ONLY, with no autosave — a shared link must
 * never write to the visitor's boards. "Copy to my boards" clones it into a
 * normal editable board with ONE undo entry back to the shared view, and
 * strips the fragment so a reload does not re-enter read-only.
 * (feature-map home: src/useShareView.ts)
 *
 * The codec arrives by DYNAMIC import (the round-bn2 lazy law): nothing about
 * sharing costs the boot path until a link is actually opened.
 *
 * ROUND GOBI-SHARE-FIX (Harvey's device test, 2026-10-29): editing the
 * fragment in the address bar used to do NOTHING — the decode ran once on
 * mount. Mount AND every `hashchange` now route through ONE decode+apply
 * path (`applyShare`). Save-gate (AS-5): the shared doc is applied WITHOUT
 * setting `boardLoadedDocId`, so `canAutosave` stays false for the whole
 * read-only view; "Copy to my boards" is the one exit, and it arms the gate
 * for the NEW board's id only. */
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

  /* The ONE decode+apply path (GOBI-SHARE-FIX): mount and every hashchange
     route through it — never a second parser; the SAME decoder every door
     uses (harness S5f); a refusal is an error card, not a throw. READ-ONLY
     rides the existing `readOnly` state (the preference key is NOT written —
     this is the link's mode, not the user's) and the save gate stays CLOSED
     (no setBoardLoadedDocId): nothing here may reach any board file. */
  const applyShare = useCallback(async (payload: string) => {
    try {
      const mod = await import('./share');
      const res = await mod.decodeShare(payload);
      /* GOBI-SHARE-ERR: a refusal takes the WHOLE scene with it — the same
         two setters the success branch writes through (no second seam), so
         the error card never sits over the previous board. */
      if (res.ok === false) {
        setShareError(res.reason); setShareDoc(null);
        setNodes([]); setEdges([]);
        return;
      }
      const doc = migrateDoc(res.board);
      setShareError(null);
      setShareDoc(doc);
      setReadOnly(true);
      readOnlyRef.current = true;
      setNodes(doc.nodes.map(n => ({...n, selected: false})));
      setEdges(doc.edges.map(e => ({...e, selected: false})));
      setCurBoard(doc);
    } catch {
      /* Same contract as the refusal (GOBI-SHARE-ERR). */
      setShareError('network'); setNodes([]); setEdges([]);
    }
  }, [setNodes, setEdges, setCurBoard, setReadOnly, readOnlyRef]);

  /** A broken link is dismissible: reload at the stripped URL so the visitor
   *  lands in the normal app (the bootstrap was skipped for the share boot,
   *  so a live re-bootstrap is a reload, not a state patch). */
  const dismissError = useCallback(() => {
    stripFragment();
    location.assign(location.pathname + location.search);
  }, []);

  /* Mount decode AND the address-bar re-decode (GOBI-SHARE-FIX), one effect:
     a corrupt payload swaps the board for the error card; restoring a valid
     one brings the board back; a removed fragment leaves cleanly (the
     reload re-boots the normal app — the same contract as dismissing a
     broken link). All deps are stable, so the listener binds once and is
     removed on unmount. */
  useEffect(() => {
    const onShareHash = () => {
      const payload = shareViewPayload();
      if (payload === null) { dismissError(); return; }
      void applyShare(payload);
    };
    if (shareViewPayload() !== null) onShareHash();
    window.addEventListener('hashchange', onShareHash);
    return () => window.removeEventListener('hashchange', onShareHash);
    /* (GOBI-SHARE-ERR) deps trimmed: the others are refs/stable setters. */
  }, [applyShare, dismissError]);

  /** "Copy to my boards": the ONE exit — creates a real board with the shared
   *  content, ONE undo entry back to the shared view (pushHistory first, the
   *  JSON-import contract), arms the save gate for the copy's id only, strips
   *  the fragment, and leaves review mode. */
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

  return {shareDoc, shareError, editCopy, dismissError} as const;
}
