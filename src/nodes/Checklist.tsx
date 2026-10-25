import {useCallback, useEffect, useState} from 'react';
import {Check, ChevronDown, X} from 'lucide-react';

const KEY = 'diagram-studio:checklist-done';
const DISMISS_KEY = 'diagram-studio:checklist-dismissed';

export type ChecklistTaskId = 'node' | 'edge' | 'label' | 'move' | 'export' | 'board';

const TASKS: {id: ChecklistTaskId; label: string}[] = [
  {id: 'node', label: 'Create a node'},
  {id: 'edge', label: 'Connect two nodes'},
  {id: 'label', label: 'Rename an arrow'},
  {id: 'move', label: 'Move something'},
  {id: 'export', label: 'Export your diagram'},
  {id: 'board', label: 'Create your own board'},
];

const readDone = (): Set<ChecklistTaskId> => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as ChecklistTaskId[]) : []);
  } catch { return new Set(); }
};

/**
 * H2 — Getting-started checklist: a compact floating panel that ticks tasks
 * as the user actually performs them. Dismissible (persisted) and collapsible
 * to a pill; auto-hides once all 6 are done.
 *
 * The completion toast was REMOVED (harvey, 2026-09-18). It was raised from a
 * once-per-mount `useRef` guard, so a ref — which resets with the page — was the
 * only thing standing between "finished all 6" and a toast on every single load.
 * The panel's own `done.size >= TASKS.length` return below is the whole
 * auto-hide now; no callback, no signal, no toast.
 */
export default function Checklist({
  doneSignal,
  hasSecondBoard,
}: {
  /** Which task just fired (idempotent). */
  doneSignal: ChecklistTaskId | null;
  /** Live count of boards — completes the "own board" task. */
  hasSecondBoard: boolean;
}) {
  const [done, setDone] = useState<Set<ChecklistTaskId>>(() => readDone());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(false);

  const persist = useCallback((next: Set<ChecklistTaskId>) => {
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }, []);

  const complete = useCallback((id: ChecklistTaskId) => {
    setDone(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persist(next);
      return next;
    });
  }, [persist]);

  // discrete signals from App
  useEffect(() => { if (doneSignal) complete(doneSignal); }, [doneSignal, complete]);
  // the "second board exists" condition
  useEffect(() => { if (hasSecondBoard) complete('board'); }, [hasSecondBoard, complete]);

  // All 6 done → auto-hide. This is a RENDER guard (the early return below), not
  // an effect: it needs no once-per-mount ref, so it cannot repeat itself on a
  // reload, and it keeps working when the checkmarks are already in localStorage.

  if (dismissed) return null;
  if (done.size >= TASKS.length) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const n = done.size;
  return (
    <div className={`gsc${collapsed ? ' collapsed' : ''}${n > 0 ? ' started' : ''}`}>
      {collapsed ? (
        <button
          type="button"
          className="gsc-pill"
          onClick={() => setCollapsed(false)}
          title="Open the getting-started checklist"
        >
          Getting started · <span className="gsc-n">{n}/{TASKS.length}</span>
        </button>
      ) : (
        <>
          <div className="gsc-head">
            <button type="button" className="gsc-head-btn" onClick={() => setCollapsed(true)} title="Collapse">
              <span className="gsc-title">Getting started</span>
              <span className="gsc-count"><span className="gsc-n">{n}</span>/{TASKS.length}</span>
              <ChevronDown size={13} className="gsc-chev" />
            </button>
            <button type="button" className="gsc-x" onClick={dismiss} title="Dismiss — hide the checklist for good">
              <X size={13} />
            </button>
          </div>
          <ul className="gsc-list">
            {TASKS.map(t => (
              <li key={t.id} className={`gsc-item${done.has(t.id) ? ' done' : ''}`}>
                <span className="gsc-check"><Check size={11} strokeWidth={3} /></span>
                <span>{t.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}