/* src/hooks/useKeyboardShortcuts.ts — APP-SPLIT S6 (t_62266c20), moved VERBATIM
 * from src/app/App.tsx (the `// ---- keyboard shortcuts ----` effect, L1857-2052
 * at 20764bb): the ONE global window keydown listener and every binding inside
 * it. The listener is BEHAVIOUR — the table below is the acceptance contract:
 * same key, same precondition, same action as when the effect lived in App's
 * render body. checks/round-app-split.mjs arms one row per binding.
 *
 * BINDING TABLE (in match order; preconditions kept verbatim):
 *   Escape                    close settings → search → help → boards, else
 *                             escapeGroup(), else clear node + edge selection
 *                             (FIRST, before the overlay guard — Escape is the
 *                             way OUT of every surface that guard protects)
 *   Shift+Digit1  (code Digit1)        rf.fitView({padding: 0.25})
 *   Shift+Digit2  (code Digit2)        toggleReadOnly()
 *   Cmd/Ctrl+Shift+\  (code Backslash) revealPanels / setPanelsVisible — hide
 *                             BOTH docked panels if either is visible, else
 *                             show both (railPanel.setShown folds in the rail)
 *   Cmd/Ctrl+Shift+[ (code BracketLeft)  revealPanel('left') — the drawer fold
 *   Cmd/Ctrl+Shift+] (code BracketRight) revealPanel('right') / the right-rail
 *                             drawer folds into railPanel.toggle()
 *   ?                         setHelp toggle        (the ONLY key in review/stale)
 *   Mod+z / Mod+Shift+z       undo() / redo()
 *   Alt+R / Alt+Shift+R (code KeyR)   rotateSelection(±ROTATE_SNAP_DEG)
 *   Mod+g / Mod+Shift+g               groupSelection() / ungroupSelection()  [not canvasLock]
 *   Alt+L (code KeyL)                 toggleLockSelection()                  [not canvasLock]
 *   Mod+c                     copySelection()
 *   Mod+v                     pasteClipboard(40, true)
 *   Mod+d                     duplicateSelection()
 *   F2                        setTitleEdit({id, at}) on the sole selected
 *                             goblin/label/customshape node
 *   ArrowLeft/Right/Up/Down   nudge(±1); +Shift → nudge(±10)
 *   ?                         setHelp toggle (edit mode)
 *   Mod+/                     toggleCode()
 *   /                         searchRef.current?.focus() — bare `/`, left panel
 *                             visible only
 *
 * PRECONDITIONS (verbatim order): `isEditable(e.target)` bail; the overlay
 * inert-guard ladder (settingsOpen / boardDlg / tgOpen / historyOpen — each
 * overlay's own capture listener owns Escape); Escape branch; the mutating
 * chords sit behind the `help || boardsOpen || searchPos` overlay guard and the
 * `readOnly || codeStale` view-only guard (the panel-chrome and Shift+1/Shift+2
 * chords deliberately sit ABOVE that guard — view concerns, placement is
 * load-bearing, comments preserved).
 *
 * LIVE PANEL READS: `hiddenRef` / `isPanelVisible` / `railPanel` travel in as
 * ctx exactly so the listener does NOT re-register when panel collapse flips
 * (the M3/S2c ref pattern — see App's mirror assignment for why it exists).
 *
 * APP-SIDE SEQUENCE NOTE: the ctx object is evaluated at RENDER time, while
 * the effect body only reads it at KEY-PRESS time — so App calls this hook
 * BELOW the declarations of hiddenRef / isPanelVisible (a `const` read before
 * its declaration line is a TDZ throw, which the old closure never hit). The
 * call replaced the effect's old position is documented in App at the new
 * call site.
 */
import {useEffect} from 'react';
import {type Edge, type Node, type ReactFlowInstance} from '@xyflow/react';
import {isEditable} from '../board/boardUtils';
import {ROTATE_SNAP_DEG} from '../layout/layoutConstants';
import {type RailPanel} from '../canvas/railPanel';
import {type StaleInfo} from '../gobi/commitText';
import {type BoardDialogResult} from '../dialogs/BoardDialog';

export interface KeyboardShortcutsCtx {
  /* selection + board doors */
  setNodes: (u: Node[] | ((ns: Node[]) => Node[])) => void;
  setEdges: (u: Edge[] | ((es: Edge[]) => Edge[])) => void;
  nodesRef: React.RefObject<Node[]>;
  rf: ReactFlowInstance | null;
  /* history + clipboard + selection ops */
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  pasteClipboard: (offset?: number, atCursor?: boolean) => void;
  duplicateSelection: () => void;
  nudge: (dx: number, dy: number) => void;
  escapeGroup: () => boolean;
  groupSelection: () => void;
  ungroupSelection: () => void;
  toggleLockSelection: () => void;
  rotateSelection: (deltaDeg: number) => void;
  /* overlays + modes */
  settingsOpen: boolean;
  setSettingsOpen: (u: boolean | ((v: boolean) => boolean)) => void;
  searchPos: {x: number; y: number} | null;
  setSearchPos: (u: {x: number; y: number} | null | ((v: {x: number; y: number} | null) => {x: number; y: number} | null)) => void;
  help: boolean;
  setHelp: (u: boolean | ((h: boolean) => boolean)) => void;
  boardsOpen: boolean;
  setBoardsOpen: (u: boolean | ((v: boolean) => boolean)) => void;
  boardDlg: BoardDialogResult['kind'] | null;
  tgOpen: boolean;
  historyOpen: boolean;
  readOnly: boolean;
  toggleReadOnly: () => void;
  codeStale: StaleInfo | null;
  canvasLock: boolean;
  toggleCode: () => void;
  setTitleEdit: (u: {id: string; at: number} | null) => void;
  sel: string | null;
  selCount: number;
  /* panel chrome (live per-render reads — see header) */
  hiddenRef: React.RefObject<{left: boolean; right: boolean}>;
  isPanelVisible: (side: 'left' | 'right') => boolean;
  railPanel: RailPanel;
  setPanelsVisible: (visible: boolean) => void;
  togglePanel: (side: 'left' | 'right') => void;
  revealPanel: (side: 'left' | 'right') => void;
  revealPanels: (visible: boolean) => void;
  /* palette search */
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export function useKeyboardShortcuts(ctx: KeyboardShortcutsCtx): void {
  const {undo, redo, copySelection, pasteClipboard, duplicateSelection, nudge, setNodes,
    setEdges, setSettingsOpen, setSearchPos, setHelp, setBoardsOpen, settingsOpen,
    searchPos, help, boardsOpen, boardDlg, tgOpen, historyOpen, escapeGroup, canvasLock,
    groupSelection, ungroupSelection, toggleLockSelection, setPanelsVisible, togglePanel,
    readOnly, codeStale, toggleReadOnly, sel, selCount, nodesRef, setTitleEdit, toggleCode,
    railPanel, hiddenRef, isPanelVisible, revealPanel, revealPanels, rotateSelection,
    rf, searchRef} = ctx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      // M / §3.3: while the Settings dialog is open the app's shortcuts are
      // inert — no bare d/z/? and no arrow-nudge while the user tabs the nav.
      // (The dialog's own capture listener owns Escape; see the branch below.)
      if (settingsOpen) return;
      // ITEM 6b: the board dialog owns the keyboard too, and this return is
      // DELIBERATELY HERE — above the Escape branch below, not in the overlay
      // guard after it. The board MENU is handled down there (Escape is the way
      // out of a menu and the branch below closes it). The DIALOG is different:
      // its own capture listener owns Escape (cancel) and Tab (the trap), so a
      // return further down would let Escape deselect every node behind the
      // dialog; `isEditable(e.target)` covers the name field. This line stops
      // only the app's shortcuts landing behind the dialog.
      if (boardDlg) return;
      /* PACKAGE-TEMPLATES §2.5 Pass 2 — the gallery owns the keyboard while it is
         up, in the SAME guard as every other overlay and for the same reason.
         It sits directly BELOW `boardDlg`: the two are independent, so with both
         open (the gallery opened from the dialog's trailing row) the app is inert
         behind them. The gallery's own capture listener owns Escape, so Escape
         never reaches the branch below and cannot deselect the canvas behind two
         scrims. */
      if (tgOpen) return;
      if (historyOpen) return;  /* HISTORY-V3 — the ledger dialog owns the keyboard like the two above (its capture listener carries Escape/Tab). */
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      // D3: Escape clears node + edge selection and closes open popovers.
      // FIRST, before the overlay guard below: Escape is the way OUT of every
      // surface that guard protects (move it after → search/help/boards stop closing).
      if (e.key === 'Escape') {
        // M: Settings closes first — before search → help → boards → clear.
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (searchPos) { setSearchPos(null); return; }
        if (help) { setHelp(false); return; }
        if (boardsOpen) { setBoardsOpen(false); return; }
        /* GROUP-LOGICAL (t_eb8fab7e): inside a logical group, Escape first LEAVES it (selection returns to the group) — the deselect below would exit the grammar entirely. */
        if (escapeGroup()) return;
        setNodes(ns => ns.map(n => n.selected ? {...n, selected: false} : n));
        setEdges(es => es.map(e2 => e2.selected ? {...e2, selected: false} : e2));
        return;
      }
      // H1: every other overlay owns the keyboard — while help, a board menu or
      // the insert palette is open, an app shortcut must not fire behind it (a
      // stray ⌘Z would undo the newcomer's work; `?` would stack sheets).
      if (help || boardsOpen || searchPos) return;
      // Shift+1 (physical Digit1) — "fit view", the Figma/Excalidraw/Miro
      // convention; carries a modifier, so legal under the no-bare-key rule.
      // Matched on `e.code`, NOT `e.key` (Shift+1 delivers `!` on most
      // layouts); the overlay guard and `isEditable` keep typing safe.
      if (e.shiftKey && e.code === 'Digit1' && !mod) {
        e.preventDefault();
        rf?.fitView({padding: 0.25});
        return;
      }
      // Shift+2 (physical Digit2) — toggle the read-only review mode. Same
      // convention as Shift+1: it carries a modifier, so it is legal under this
      // app's no-bare-key rule, and it is matched on `e.code`, NOT `e.key` —
      // Shift+2 delivers `@` as the key on most layouts, so a key-based match
      // would break.
      // PLACEMENT IS LOAD-BEARING: ABOVE the `if (readOnly)` early-return — the
      // mode must be enterable AND leavable by the same key, before the handler
      // starts swallowing everything (below it, the shortcut is one-way: ON and
      // never OFF). It also sits after the overlay guard above, so a stray
      // Shift+2 cannot flip the mode behind help, a board menu or the palette.
      if (e.shiftKey && e.code === 'Digit2' && !mod) {
        e.preventDefault();
        toggleReadOnly();
        return;
      }
      // ---- PACKAGE-Q: panel chrome — three chords, ONE writer each ----------
      //   Cmd+Ctrl+Shift+backslash → hide BOTH docked panels if either one is on
      //                              screen, else show BOTH (a single panel is
      //                              still reachable from its own chevron)
      //   Cmd+Ctrl+Shift+[         → toggle the LEFT panel only
      //   Cmd+Ctrl+Shift+]         → toggle the RIGHT panel only
      //
      // THE GROUP CHORD GAINED A MODIFIER: on macOS the user asked for Cmd AND
      // Ctrl together, and `mod` above is meta-OR-ctrl so it cannot express the
      // pair — the real modifier PAIR is tested below, per platform. MATCHED ON
      // `e.code`, NEVER the `k` string: Shift rewrites the delivered character,
      // so a glyph match never fires (the Shift+1/Shift+2 trap above).
      //
      // VIEW-MODE CHROME (2026-11-14) — PLACEMENT IS LOAD-BEARING, now ABOVE the
      // read-only early-return below, mirroring Shift+2's argument: hiding or
      // showing a panel is a VIEW concern, not a board mutation, so review mode
      // must reach these branches. In review they drive the TRANSIENT reveal
      // (src/canvas/reviewChrome.ts — local state, never persisted; the
      // `diagram-studio:panels` layout the editor will return to is never
      // written); in edit mode the same branches keep the persisted writers. The
      // overlay guard above still swallows them behind help, a board menu or the
      // insert palette, and the stale lock gets NO reveal either: with
      // `codeStale` (and not readOnly) the guard below still swallows them.
      // They sit ABOVE the arrow-nudge, `?`, `/` branches, which they shadow.
      //
      // The VISIBLE-state read stays the `hiddenRef` one that made the M3/S2c
      // desync unreachable, and `hiddenRef.current` is now the EFFECTIVE state
      // (what the eye sees), so in review the group chord's "any visible → hide
      // both" describes the revealed panels too. ONE atomic both-sides write of
      // a VISIBLE decision per press; do not reintroduce a second path.
      const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
      const panelChord = mac ? (e.metaKey && e.ctrlKey && e.shiftKey) : (e.ctrlKey && e.shiftKey);
      if (panelChord && (readOnly || !codeStale) &&
          (e.code === 'Backslash' || e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        if (e.code === 'Backslash') {
          e.preventDefault();
          const {left, right} = hiddenRef.current;
          // any panel visible → hide both; none visible → show both
          if (readOnly) revealPanels(left && right); else { if (railPanel.active) railPanel.setShown(left && right); setPanelsVisible(left && right); }
        } else if (e.code === 'BracketLeft') {
          e.preventDefault();
          if (readOnly) revealPanel('left'); else togglePanel('left');
        } else if (e.code === 'BracketRight') {
          e.preventDefault();
          if (readOnly) revealPanel('right'); else if (railPanel.active) railPanel.toggle(); else togglePanel('right');
        }
        return;
      }
      // Part B: review mode / UNISURF-S4 stale own no mutation. Placed after
      // `isEditable`, Settings, Escape and Shift+1 (viewport/surface changes)
      // on purpose; everything below mutates. `?` stays available (pure read).
      if (readOnly || !!codeStale) {
        if (k === '?') { setHelp(h => !h); return; }
        return;
      }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      /* ROUND ROTATE — Alt+R / Alt+Shift+R = ±15° on the selection (single
         node: its own delta; multi: each member keeps its own delta while
         its centre orbits the selection centroid — ONE undo entry, the
         useRotation chord writer). Matched on e.code (Shift rewrites the
         delivered character), never `mod` — Alt alone, so the browser's
         own menu-focus chords are not stolen. */
      if (e.altKey && !mod && e.code === 'KeyR') {
        e.preventDefault();
        rotateSelection(e.shiftKey ? -ROTATE_SNAP_DEG : ROTATE_SNAP_DEG);
        return;
      }
      /* GROUP-OBJECT + LOCK v1: Cmd+G group, Cmd+Shift+G ungroup, Alt+L lock (NOT Cmd+L — the browser owns the address bar). */
      if (mod && k === 'g' && !canvasLock) { e.preventDefault(); (e.shiftKey ? ungroupSelection : groupSelection)(); return; }
      if (e.altKey && !mod && e.code === 'KeyL' && !canvasLock) { e.preventDefault(); toggleLockSelection(); return; }
      if (mod && k === 'c') { copySelection(); return; }
      if (mod && k === 'v') { e.preventDefault(); pasteClipboard(40, true); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
      // INLINE-TITLE (t_cb9335df) — F2 opens the in-place title editor on the
      // sole selected node, the keyboard twin of double-clicking the title.
      // TABLE nodes are out of scope (their header renames through the
      // inspector); review/stale mode already returned above, so the editor
      // can never open on a locked canvas. The token is render-injected —
      // F2 on a FRESH selection still refires because Date.now() moves.
      if (e.key === 'F2' && !mod) {
        const n = selCount === 1 ? nodesRef.current.find(m => m.id === sel) : undefined;
        if (n && (n.type === 'goblin' || n.type === 'label' || n.type === 'customshape')) {
          e.preventDefault();
          setTitleEdit({id: n.id, at: Date.now()});
        }
        return;
      }
      // arrow keys nudge the selection: 1px, Shift+arrow 10px
      if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown') {
        const step = e.shiftKey ? 10 : 1;
        const selAny = nodesRef.current.some(n => n.selected);
        if (!selAny) return;
        e.preventDefault();
        if (k === 'arrowleft') nudge(-step, 0);
        else if (k === 'arrowright') nudge(step, 0);
        else if (k === 'arrowup') nudge(0, -step);
        else nudge(0, step);
        return;
      }
      // D3: Escape clears node + edge selection and closes any open popovers
      // (handled above, before the overlay guard — Escape must stay the way out).
      if (k === '?') { setHelp(h => !h); return; }
      // ---- PACKAGE-N 2c: `/` focuses the panel's shape search (draw.io's
      // convention). Bare `/` only — the mod+/ variant is the code pane's
      // (UNISURF-S3 below), and the overlay guard above plus the
      // `isEditable` early-return keep both from firing behind a dialog or
      // inside a field.
      // UNISURF-S3 — Cmd/Ctrl+/ toggles the code pane rail (spec §6: the
      // binding was free; mods pass the editable guard at the top).
      if (k === '/' && mod) { e.preventDefault(); toggleCode(); return; }
      if (k === '/' && !mod && !isEditable(e.target) && isPanelVisible('left')) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, copySelection, pasteClipboard, duplicateSelection, nudge, setNodes, setEdges, searchPos, help, boardsOpen, settingsOpen, escapeGroup,
      groupSelection, ungroupSelection, toggleLockSelection,
      setPanelsVisible, readOnly, codeStale, toggleReadOnly, boardDlg, tgOpen, toggleCode, sel, selCount, setTitleEdit, canvasLock, railPanel]);
}
