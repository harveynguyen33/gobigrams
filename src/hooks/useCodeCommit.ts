/* useCodeCommit.ts — UNISURF-S4 (SPEC-UNIFIED-SURFACE §4): App's half of the
 * pane's commit lane. The pane parses (commitText, lazy); THIS hook owns:
 *   · ONE undo entry per typing streak, never per keystroke — the streak opens
 *     with the first VALID commit of a focus session and closes on blur. An
 *     invalid attempt pushes NOTHING: the board never moved (same convention as
 *     every gesture: onNodeDragStart pushes once per drag).
 *   · STALE IS CLEARED ONLY BY A SUCCESSFUL COMMIT — never by blur, so the
 *     draft + banner + lock outlive focus (clicking the locked canvas is not
 *     consent to discard the fix). Spec §4.4.
 * UNISURF-S11 — the freeze FLUSHES the save the autosave debounce already owed
 * BEFORE it arms the lock (REVIEW-4 measured that write landing 684 ms into a
 * stale period), then setNodes/setEdges are simply never called while stale.
 */
import {useCallback, useRef, useState} from 'react';
import type * as React from 'react';
import type {Edge, Node} from '@xyflow/react';
import type {CodeCommit, StaleInfo} from '../gobi/commitText';

/* Positional parameters, not an opts object: the bundle ratchet is raw bytes
   and object property names survive minification (AGENTS.md perf ratchet). */
export function useCodeCommit(
  pushHistory: () => void,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  /** UNISURF-S11 — the persistence door (REVIEW-4: the only ungated channel).
   *  A freeze flushes what the autosave debounce already owed BEFORE it arms
   *  the lock, so nothing lands mid-stale and nothing is dropped either. */
  flushPending: () => Promise<void>,
) {
  const streak = useRef(false);
  /** latest-freeze-wins across the flush await: a slow flush must not install
   *  an older stale report over a newer verdict. */
  const seq = useRef(0);
  const [stale, setStale] = useState<StaleInfo | null>(null);

  const commit = useCallback(async (r: CodeCommit) => {
    const mine = ++seq.current;
    if (r.ok === false) { await flushPending(); if (mine === seq.current) setStale(r.stale); return; }
    if (!streak.current) { streak.current = true; pushHistory(); }
    setStale(null);
    setNodes(r.nodes);
    setEdges(r.edges);
  }, [pushHistory, setNodes, setEdges, flushPending]);

  /** pane blur: the streak (one undo entry) ends; a stale draft is KEPT. */
  const endTyping = useCallback(() => { streak.current = false; }, []);

  return [stale, commit, endTyping] as const;
}
