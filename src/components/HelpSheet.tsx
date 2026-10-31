/* feature-map home: src/components/HelpSheet.tsx */
/* HelpSheet.tsx — ROUND BN-3 PHASE B: the `?` cheat-sheet popover, lifted
 *  verbatim from App()'s return (App.tsx ~4483). The block is fully presentational:
 *  App owns `help` (open state), the outside-click refs and the feedback opener
 *  (it needs App state), so they stay props/refs threaded from App. No context,
 *  no store; `MessageSquarePlus` moved with the block (its only use).
 *
 *  ONBOARD-P2/3 (2026-10-31) — the four capabilities the deleted step-by-step
 *  overlay was the ONLY surface for live here as plain rows above the shortcuts.
 *  Facts about the product, not steps: no numbering, no order, no control.
 *
 *  The help-row lines are single-line on purpose: package-o-metrics measures
 *  their widths from the source text (label/hint/keys/gestures regexes) —
 *  reformatting them breaks the BN-3 reader update. */
import type * as React from 'react';
import {MessageSquarePlus} from 'lucide-react';
import Tooltip from '../Tooltip';

type HelpSheetProps = {
  /** the `?` toolbar button — feedback returns focus here when it closes. */
  btnRef: React.RefObject<HTMLButtonElement | null>;
  /** the popover root — App's outside-click closer reads it. */
  popRef: React.RefObject<HTMLDivElement | null>;
  /** App's open state, threaded (App owns `help`; this sheet is dumb). */
  open: boolean;
  onToggle: () => void;
  /** closes the sheet and opens the ONE feedback dialog (App's openFeedback). */
  onSendFeedback: () => void;
};

/** The `?` cheat sheet: what the product can do + the keyboard and mouse-gesture
 *  reference. Mounted inside `.canvas-wrap` beside the toolbar; `.help-pop`
 *  z-index (30) sits below the Settings modal (70) and the feedback overlay (80). */
export function HelpSheet({btnRef, popRef, open, onToggle, onSendFeedback}: HelpSheetProps) {
  return <>
        <Tooltip label="Keyboard shortcuts (?)">
          <button
            type="button"
            ref={btnRef}
            className={`help-btn${open ? ' on' : ''}`}
            aria-label="Keyboard shortcuts"
            onClick={onToggle}
          >?</button>
        </Tooltip>
        {open && (
          <div className="help-pop" ref={popRef}>
            <h4>What Gobigrams can do</h4>
            <div className="help-cap">
              <div className="help-cap-row"><b>Animated flow</b><span>dots, dashes, pulses or an icon moving along a connection</span></div>
              <div className="help-cap-row"><b>Cardinality</b><span>crow's foot on either end, including on plain connections</span></div>
              <div className="help-cap-row"><b>Tables as nodes</b><span>columns, keys and checklists as first-class shapes</span></div>
              <div className="help-cap-row"><b>Autosave</b><span>server board when the API exists, browser storage otherwise — the UI says which</span></div>
            </div>
            <h4>Shortcuts</h4>
            {/* ROUND BI, ITEM 3 — the feedback form, one click from the shortcuts
                sheet. It closes the popover FIRST so the dialog's own autofocus
                lands inside it and Esc hands the caret back to this ? button. */}
            <button
              type="button"
              className="help-action-btn"
              data-help-feedback
              onClick={onSendFeedback}
            >
              <MessageSquarePlus size={13} /> Send feedback
            </button>
            {/* Item 4: this sheet and Settings → Shortcuts must present the
                SAME information — same two groups, same entries, same order,
                same wording. Keys render as `kbd` chips; gestures render as
                plain `.gesture` tokens (never chips), exactly as Settings does. */}
            <div className="help-group">Keyboard</div>
            <div className="help-row"><span>Undo</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>Z</kbd></span></div>
            <div className="help-row"><span>Redo</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⇧</kbd><kbd>Z</kbd></span></div>
            <div className="help-row"><span>Delete selection</span><span className="help-keys"><kbd>Del</kbd></span></div>
            <div className="help-row"><span>Copy / paste / duplicate</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>C</kbd><kbd>V</kbd><kbd>D</kbd></span></div>
            <div className="help-row"><span>Rotate selection<span className="help-hint">Shift-drag the grip snaps 15°</span></span><span className="help-keys"><kbd>Alt</kbd><kbd>R</kbd></span></div>
            <div className="help-row"><span>Deselect</span><span className="help-keys"><kbd>Esc</kbd></span></div>
            <div className="help-row"><span>Fit view to diagram</span><span className="help-keys"><kbd>⇧</kbd><kbd>1</kbd></span></div>
            <div className="help-row"><span>Read-only review</span><span className="help-keys"><kbd>⇧</kbd><kbd>2</kbd></span></div>
            {/* the same hint Settings → Shortcuts shows on this row, so the two
                surfaces carry the same information (item 4), not just the same
                labels */}
            <div className="help-row"><span>Nudge selection<span className="help-hint">1px per keypress, 10px with ⇧</span></span><span className="help-keys"><kbd>←↑↓→</kbd></span></div>
            <div className="help-row"><span>Collapse / expand both panels</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>{'\\'}</kbd></span></div>
            <div className="help-row"><span>Toggle left panel</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>[</kbd></span></div>
            <div className="help-row"><span>Toggle right panel</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>]</kbd></span></div>
            <div className="help-group">Mouse &amp; trackpad</div>
            <div className="help-row"><span>Insert node</span><span className="gesture"><span className="gesture-token">double-click canvas</span></span></div>
            <div className="help-row"><span>Connect nodes</span><span className="gesture"><span className="gesture-token">drag from a node edge</span></span></div>
            <div className="help-row"><span>Edit a connection</span><span className="gesture"><span className="gesture-token">click the edge</span></span></div>
            <div className="help-row"><span>Select multiple</span><span className="gesture"><span className="gesture-token">⌘/Ctrl + click</span></span></div>
            <div className="help-row"><span>Rename connection</span><span className="gesture"><span className="gesture-token">double-click the label</span></span></div>
          </div>
        )}
  </>
}
