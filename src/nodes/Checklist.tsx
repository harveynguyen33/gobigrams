import {useState} from 'react';
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

/** The six tasks in the panel's reading order — exported because App gates the
 *  `?` sheet's "show it again" row on how many of them are ticked. */
export const CHECKLIST_TASKS = TASKS;

/** Read the ticked set. A malformed or unreachable value is the same as none:
 *  stale persisted state is cleared, never migrated. */
export function readChecklistDone(): Set<ChecklistTaskId> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as ChecklistTaskId[]) : []);
  } catch { return new Set(); }
}

/** Persist the ticked set. App hands over the NEXT set it just computed, so the
 *  write can never persist a list it re-read at an unlucky moment. */
export function persistChecklistDone(next: ReadonlySet<ChecklistTaskId>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* ignore */ }
}

/** All six done → the panel auto-hides BY DESIGN, so offering the way back
 *  would advertise a surface that cannot appear. */
export const isChecklistComplete = (done: ReadonlySet<ChecklistTaskId>) => done.size >= TASKS.length;

export function readChecklistDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/** ONBOARD-P4 B1 — the dismissal is REVERSIBLE. `false` REMOVES the key instead
 *  of writing '0': the dismissed state is the key's PRESENCE, so a stored '0'
 *  would be a second spelling of one fact. */
export function writeChecklistDismissed(v: boolean): void {
  try {
    if (v) localStorage.setItem(DISMISS_KEY, '1');
    else localStorage.removeItem(DISMISS_KEY);
  } catch { /* ignore */ }
}

/**
 * H2 — Getting-started checklist: a compact floating panel that ticks tasks
 * as the user actually performs them. Collapsible to a pill; auto-hides once
 * all 6 are done.
 *
 * The completion toast was REMOVED (harvey, 2026-09-18). It was raised from a
 * once-per-mount `useRef` guard, so a ref — which resets with the page — was the
 * only thing standing between "finished all 6" and a toast on every single load.
 * The panel's own `done.size >= TASKS.length` return below is the whole
 * auto-hide now; no callback, no signal, no toast.
 *
 * ONBOARD-P4 (2026-10-31) — THE PANEL IS A VIEW; App owns both facts. The `?`
 * sheet can now RE-OPEN the panel, so `dismissed` has a second writer and a
 * second reader: keeping it in here would have meant two owners of one fact
 * that cannot see each other, which is the reconciliation bug this file already
 * paid for (the `hasSecondBoard` effect that used to live below ticked the board
 * task from a COUNT of boards, so renaming the only board never ticked it).
 * `collapsed` stays local — nothing outside the panel reads or sets it.
 */
export default function Checklist({
  done,
  dismissed,
  onDismiss,
}: {
  /** The ticked tasks — App's state, re-read from storage on boot. */
  done: ReadonlySet<ChecklistTaskId>;
  /** App's state; `true` hides the panel until the user asks for it back. */
  dismissed: boolean;
  /** Persists the dismissal AND flips App's state — one owner, one write. */
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // All 6 done → auto-hide. This is a RENDER guard (the early return below), not
  // an effect: it needs no once-per-mount ref, so it cannot repeat itself on a
  // reload, and it keeps working when the checkmarks are already in localStorage.

  if (dismissed) return null;
  if (done.size >= TASKS.length) return null;

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
            <button type="button" className="gsc-x" onClick={onDismiss} title="Dismiss — bring it back from the ? sheet">
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
