/* feature-map home: src/components/HelpSheet.tsx */
/* HelpSheet.tsx — ROUND BN-3 PHASE B: the `?` cheat-sheet popover, lifted
 *  verbatim from App()'s return (App.tsx ~4483). The block is fully presentational:
 *  App owns `help` (open state), the outside-click refs and the two openers
 *  (tour, feedback — both need App state), so they stay props/refs threaded from
 *  App. No context, no store; `Waypoints` + `MessageSquarePlus` icons moved with
 *  the block (their only uses).
 *
 *  The help-row lines are single-line on purpose: package-o-metrics measures
 *  their widths from the source text (label/hint/keys/gestures regexes) —
 *  reformatting them breaks the BN-3 reader update. */
import type * as React from 'react';
import {Waypoints, MessageSquarePlus} from 'lucide-react';
import Tooltip from '../Tooltip';

type HelpSheetProps = {
  /** the `?` toolbar button — feedback returns focus here when it closes. */
  btnRef: React.RefObject<HTMLButtonElement | null>;
  /** the popover root — App's outside-click closer reads it. */
  popRef: React.RefObject<HTMLDivElement | null>;
  /** App's open state, threaded (App owns `help`; this sheet is dumb). */
  open: boolean;
  onToggle: () => void;
  /** closes the sheet and opens the guided tour (App's `tourOpen`). */
  onTakeTour: () => void;
  /** closes the sheet and opens the ONE feedback dialog (App's openFeedback). */
  onSendFeedback: () => void;
};

/** The `?` cheat sheet: keyboard + mouse-gesture reference. Mounted inside
 *  `.canvas-wrap` beside the toolbar; `.help-pop` z-index (30) sits below the
 *  Settings modal (70) and the feedback overlay (80). */
export function HelpSheet({btnRef, popRef, open, onToggle, onTakeTour, onSendFeedback}: HelpSheetProps) {
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
            <h4>Shortcuts</h4>
            {/* Item 3a: the tour entry point is the FIRST element in the sheet —
                directly under the title and above the Keyboard group — so it is
                the most discoverable thing in the popover. Its spacing moved
                from its top to its bottom (see `.help-tour-btn` in styles.css). */}
            <button type="button" className="help-tour-btn" onClick={onTakeTour}>
              <Waypoints size={13} /> Take a tour
            </button>
            {/* ROUND BI, ITEM 3 — the SECOND action of the same block: the
                feedback form, one click from the shortcuts sheet. Same
                .help-tour-btn treatment (its own 8px bottom margin is the gap
                between the two, so the pair reads as one block and no colour or
                new class is introduced). The popover closes FIRST, exactly like
                the tour button, so the dialog's own autofocus lands inside it
                and Esc hands the caret back to this ? button. */}
            <button
              type="button"
              className="help-tour-btn"
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
            <div className="help-row"><span>Deselect</span><span className="help-keys"><kbd>Esc</kbd></span></div>
            <div className="help-row"><span>Fit view to diagram</span><span className="help-keys"><kbd>⇧</kbd><kbd>1</kbd></span></div>
            <div className="help-row"><span>Toggle read-only review mode</span><span className="help-keys"><kbd>⇧</kbd><kbd>2</kbd></span></div>
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
