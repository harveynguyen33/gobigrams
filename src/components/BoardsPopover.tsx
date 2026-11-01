/* BoardsPopover.tsx — ROUND GOBI-S1 extraction (the App.tsx hard cap may
 * never grow): the boards menu's portal'd popover JSX, moved VERBATIM from
 * App()'s panel-head. App still computes every value (boardsOpen,
 * boardsPopPos/clamp, the lists, the actions) — this file is mount glue only,
 * same shape as the ModalMounts extraction. Every comment travelled with its
 * code so the history stays where the code is.  (feature-map home: src/components/BoardsPopover.tsx) */
import type * as React from 'react';
import {createPortal} from 'react-dom';
import {LayoutTemplate, Pencil, Plus, Copy, Trash2, Save} from 'lucide-react';
import type {BoardDoc, BoardMeta} from '../boards';
import {getPreset} from '../presets';

type Props = {
  open: boolean;
  pos: {left: number; top: number; maxW: number} | null;
  modeLabel: string;
  localMode: boolean;
  storageEstimate: string;
  boardList: BoardMeta[];
  curBoard: BoardDoc | null;
  fmtDate: (ts: number) => string;
  onOpenBoard: (id: string) => void;
  onClose: () => void;
  onNewBoard: () => void;
  onTemplates: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveNow: () => void;
};

/** The popover is portal'd to body and position:fixed (Tooltip.tsx:205
 *  precedent): `.panel` clips at 232px (overflow:hidden), so the 360px popup
 *  could never render inside the head. The inline style carries the anchor
 *  computed by `boardsPopClamp` (left = button right + 6, top = button top,
 *  max-width = viewport − anchor − 8). */
export default function BoardsPopover(p: Props) {
  if (!p.open || !p.pos) return null;
  return createPortal(
    <div
      className="pop boards-pop"
      style={{position: 'fixed', left: p.pos.left, top: p.pos.top, maxWidth: Math.min(360, p.pos.maxW), width: 360}}
    >
      {/* AT-1 — mode is VISIBLE, not guessed: one small line above the
          list. server → "Saved to server files"; local → "Saved in this
          browser". No dead buttons, no modal, no override (the mode follows
          the host; a manual switcher is out of scope). */}
      <div className="boards-mode" data-storage-mode aria-live="polite">{p.modeLabel}</div>
      {/* AT-4 #2 — the storage readout (local mode only): estimate() as
          "X MB used of ~Y MB" + ONE honesty sentence. No scare modals; the
          JSON export it names is the Export modal's JSON button. */}
      {p.localMode && p.storageEstimate && (
        <div className="boards-mode boards-storage-readout" data-storage-readout>
          {p.storageEstimate}
        </div>
      )}
      {/* ITEM B — the LIST owns the scroll (`overflow-y: auto`,
          `max-height: 300px`); the actions block below is PINNED and always
          visible (Save now reachable at any list length). */}
      <div className="boards-list">
        {p.boardList.map(b => (
          <button
            key={b.id}
            type="button"
            className={`pop-item boards-item${b.id === p.curBoard?.id ? ' current' : ''}`}
            title={b.name}
            onClick={() => p.onOpenBoard(b.id)}
          >
            {/* ITEM B — de-cramped row: the NAME is its own ellipsising line
                and the preset badge sits OUTSIDE it (it used to live INSIDE
                the ellipsising span and clipped to "Ar…" on any narrow
                popup). `title` on the row carries the full name through
                truncation. */}
            <span className="boards-item-name">{b.name}</span>
            <span className="boards-item-preset">{getPreset(b.preset).label}</span>
            <span className="boards-item-meta">
              {b.nodeCount}n · {b.edgeCount}e · {p.fmtDate(b.updatedAt)}
            </span>
          </button>
        ))}
        {!p.boardList.length && <div className="boards-empty">No boards yet</div>}
      </div>
      <div className="boards-actions">
        {/* ITEM 6b — every row closes the menu and opens the designed
            dialog. Focus returns to the BOARDS BUTTON on close, not to the
            row: choosing a row unmounts the menu, so a row ref is already
            null by the time the dialog finishes. The trigger that still
            exists is the one focus goes back to. */}
        <button type="button" className="pop-item" onClick={p.onNewBoard}>
          <Plus size={14} /> New board
        </button>
        {/* PACKAGE-TEMPLATES §2.5 Pass 2 — the gallery's ONLY entry point
            (D2: boards menu only; a toolbar chip is a recorded deferral, not
            an omission to fix here). ROUND 4 ITEM 2 renamed the menu row to
            "Create from Templates"; ITEM B (2026-10-22, Harvey: the label
            must NOT wrap) shortened it to "Templates" — the handler, the
            stash-clear and the route are untouched (checks tg11 + round-4 i2
            re-anchored, dated). ROUND 6 ITEM 3 — this route has NO typed
            name, so it empties the dialog's name stash here. */}
        <button type="button" className="pop-item" onClick={p.onTemplates}>
          <LayoutTemplate size={14} /> Templates
        </button>
        <button type="button" className="pop-item" disabled={!p.curBoard} onClick={p.onRename}>
          <Pencil size={14} /> Rename
        </button>
        <button type="button" className="pop-item" disabled={!p.curBoard} onClick={p.onDuplicate}>
          <Copy size={14} /> Duplicate
        </button>
        <button type="button" className="pop-item" disabled={!p.curBoard} onClick={p.onDelete}>
          <Trash2 size={14} /> Delete
        </button>
        <button type="button" className="pop-item primary" disabled={!p.curBoard} onClick={p.onSaveNow}>
          <Save size={14} /> Save now
        </button>
      </div>
    </div>,
    document.body,
  );
}
