/* Toolbar.tsx — ROUND BN-3 PHASE B: the canvas toolbar + the 2+-selection
 *  action bar, lifted verbatim from App()'s return (App.tsx ~4269-4387).
 *  Every state stays in App and is threaded as props (no context, no store).
 *  The two handlers with bodies moved verbatim into the prop callbacks —
 *  same statements, new owner. data-settings-btn and every aria-label are
 *  pinned by harnesses (round-bh-feedback clicks [data-settings-btn]) and
 *  are unchanged. */
import type * as React from 'react';
import type {Node, ReactFlowInstance} from '@xyflow/react';
import {
  Undo2, Redo2, Maximize, Magnet, Copy, Upload,
  Trash2, LayoutGrid, AlignCenter, Eye,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
  Settings as SettingsIcon,
} from 'lucide-react';
import Tooltip from '../Tooltip';
import type {HelperGuides} from '../helperLines';

type ToolbarProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  readOnly: boolean;
  onToggleReadOnly: () => void;
  /** GOBI-SHARE-LOCK — true while a share view owns the canvas: the read-only
   *  toggle is disabled with a tooltip naming the ONE exit. */
  shareLock: boolean;
  alignGuides: boolean;
  onSetAlignGuides: (v: boolean) => void;
  onSetGuides: (g: HelperGuides) => void;
  snap: boolean;
  onSetSnap: (v: boolean) => void;
  onPushHistory: () => void;
  onSetNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  gridSize: number;
  onDuplicate: () => void;
  onAutoLayout: () => void;
  onOpenExport: (v: boolean) => void;
  settingsOpen: boolean;
  onOpenSettings: (v: boolean) => void;
  settingsBtnRef: React.RefObject<HTMLButtonElement | null>;
  selCount: number;
  onAlign: (kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onDelete: () => void;
  /** the toolbar's 1px separator — App still owns `sep` (the inspector reuses it). */
  sep: () => React.ReactNode;
};

export function Toolbar(p: ToolbarProps) {
  return (<>
        <div className="toolbar">
          <Tooltip label="Undo — Cmd/Ctrl+Z">
            <button className="tbtn-icon" aria-label="Undo" disabled={!p.canUndo} onClick={p.onUndo}><Undo2 size={15} /></button>
          </Tooltip>
          <Tooltip label="Redo — Cmd/Ctrl+Shift+Z">
            <button className="tbtn-icon" aria-label="Redo" disabled={!p.canRedo} onClick={p.onRedo}><Redo2 size={15} /></button>
          </Tooltip>
          {p.sep()}
          <Tooltip label="Fit view — Shift+1">
            <button className="tbtn-icon" aria-label="Fit view" onClick={p.onFitView}><Maximize size={15} /></button>
          </Tooltip>
          {/* Part B — read-only review mode: a VIEW toggle, not an export. */}
          <Tooltip label={p.shareLock ? 'Shared link — read-only. Use Copy to my boards to make it yours.' : p.readOnly ? 'Read-only review: ON — drag and scroll to pan, nothing can be selected or moved — Shift+2' : 'Read-only review: OFF — Shift+2'}>
            {/* GOBI-SHARE-LOCK — a disabled button fires no mouse events in Chrome; the wrap span carries the hover (.tbtn-hold). */}
            <span className="tbtn-hold"><button className={`tbtn-icon${p.readOnly ? ' on' : ''}`}
              aria-label="Read-only review" aria-pressed={p.readOnly}
              disabled={p.shareLock} aria-disabled={p.shareLock}
              onClick={p.onToggleReadOnly}
            ><Eye size={15} /></button></span></Tooltip>
          <Tooltip label={p.alignGuides ? 'Alignment guides: ON — a lined-up neighbour gets a dashed guide and the node snaps to it' : 'Alignment guides: OFF — drag freely, no auto-align'}>
            <button
              className={`tbtn-icon${p.alignGuides ? ' on' : ''}`}
              aria-label="Alignment guides"
              aria-pressed={p.alignGuides}
              onClick={() => {
                const next = !p.alignGuides;
                p.onSetAlignGuides(next);
                if (!next) p.onSetGuides({vertical: null, horizontal: null});
              }}
            ><AlignCenter size={15} /></button>
          </Tooltip>
          <Tooltip label={p.snap ? `Snap to grid: ON — nodes align to ${p.gridSize}px` : 'Snap to grid: OFF — free drag'}>
            <button
              className={`tbtn-icon${p.snap ? ' on' : ''}`}
              aria-label="Snap to grid"
              aria-pressed={p.snap}
              onClick={() => {
                const next = !p.snap;
                p.onSetSnap(next);
                // when turning snap ON, round existing nodes onto the grid so the
                // whole diagram aligns; turning it OFF returns to free dragging.
                if (next) {
                  p.onPushHistory();
                  p.onSetNodes(ns => ns.map(n => ({
                    ...n,
                    position: {
                      x: Math.round(n.position.x / p.gridSize) * p.gridSize,
                      y: Math.round(n.position.y / p.gridSize) * p.gridSize,
                    },
                  })));
                }
              }}
            ><Magnet size={15} /></button>
          </Tooltip>
          <Tooltip label="Duplicate selection — Cmd/Ctrl+D">
            <button className="tbtn-icon" aria-label="Duplicate selection" onClick={p.onDuplicate}><Copy size={15} /></button>
          </Tooltip>
          {p.sep()}
          <Tooltip label="Auto-arrange into clean layers (animated, undoable)">
            <button className="tbtn-icon" aria-label="Auto-layout diagram" onClick={p.onAutoLayout}><LayoutGrid size={15} /></button>
          </Tooltip>
          {p.sep()}

          <div style={{position: 'relative'}}>
            <Tooltip label="Export / Import — scope, format, theme, live preview">
              <button className="tbtn-dd" aria-label="Import and export menu" onClick={() => p.onOpenExport(true)}>
                <Upload size={13} style={{verticalAlign: -2}} /> Export
              </button>
            </Tooltip>
          </div>

          {p.sep()}
          <button
            type="button"
            ref={p.settingsBtnRef}
            className="tbtn-dd settings-btn"
            data-settings-btn
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={p.settingsOpen}
            onClick={() => p.onOpenSettings(true)}
          ><SettingsIcon size={14} /> Settings</button>

          {/* AQ12 — align/distribute moved OFF the toolbar: they only mean
              something WITH a selection, so they live on the selection bar
              below (the toolbar kept duplicate, export, settings...). */}
        </div>

        {/* floating action bar for a 2+ node selection. AQ13 — redesigned:
            ONE icon language (lucide at 15px everywhere — the old mix of
            oversized Copy/Trash + skinny unicode arrows ⇤↔⇥ read as three
            different bars glued together), a single-line count chip, and an
            even gap rhythm from the flex container instead of ad-hoc seps. */}
        {p.selCount >= 2 && (
          <div className="sel-bar">
            <span className="sel-count">{p.selCount}</span>
            <span className="sel-count-label">selected</span>
            {p.sep()}
            <Tooltip label="Duplicate — Cmd/Ctrl+D">
              <button className="tbtn-icon" aria-label="Duplicate selection" onClick={p.onDuplicate}><Copy size={15} /></button>
            </Tooltip>
            <Tooltip label="Delete — Del">
              <button className="tbtn-icon" aria-label="Delete selection" onClick={p.onDelete}><Trash2 size={15} /></button>
            </Tooltip>
            {p.sep()}
            <Tooltip label="Align left edges"><button className="tbtn-icon" aria-label="Align left" onClick={() => p.onAlign('left')}><AlignStartVertical size={15} /></button></Tooltip>
            <Tooltip label="Align horizontal centers"><button className="tbtn-icon" aria-label="Align horizontal centers" onClick={() => p.onAlign('hcenter')}><AlignCenterVertical size={15} /></button></Tooltip>
            <Tooltip label="Align right edges"><button className="tbtn-icon" aria-label="Align right" onClick={() => p.onAlign('right')}><AlignEndVertical size={15} /></button></Tooltip>
            <Tooltip label="Align top edges"><button className="tbtn-icon" aria-label="Align top" onClick={() => p.onAlign('top')}><AlignStartHorizontal size={15} /></button></Tooltip>
            <Tooltip label="Align vertical middles"><button className="tbtn-icon" aria-label="Align vertical middles" onClick={() => p.onAlign('vcenter')}><AlignCenterHorizontal size={15} /></button></Tooltip>
            <Tooltip label="Align bottom edges"><button className="tbtn-icon" aria-label="Align bottom" onClick={() => p.onAlign('bottom')}><AlignEndHorizontal size={15} /></button></Tooltip>
            {p.sep()}
            <Tooltip label="Distribute horizontally"><button className="tbtn-icon" aria-label="Distribute horizontally" onClick={() => p.onDistribute('h')}><AlignHorizontalSpaceAround size={15} /></button></Tooltip>
            <Tooltip label="Distribute vertically"><button className="tbtn-icon" aria-label="Distribute vertically" onClick={() => p.onDistribute('v')}><AlignVerticalSpaceAround size={15} /></button></Tooltip>
          </div>
        )}
  </>);
}
