/* ModalMounts.tsx — ROUND BN-3 PHASE B: the five top-level modal mounts, lifted
 *  from App()'s return (BoardDialog, TemplatesGallery, Settings, FeedbackDialog,
 *  ExportModal + the hidden JSON file input). The mounted components are
 *  untouched — this is ONLY the mount glue; every value App computed is still
 *  computed in App and threaded explicitly (no context, no store; the AGENTS.md
 *  prop-thread rule).
 *
 *  MOUNT ORDER IS LOAD-BEARING and preserved exactly: the gallery mounts AFTER
 *  the board dialog (package-templates §2.5 — the gallery's scrim covers the
 *  dialog), and every overlay sits inside `.canvas-wrap` so its scrim covers
 *  the canvas column only. */
import type * as React from 'react';
import type {Node, Edge} from '@xyflow/react';
import BoardDialog from '../BoardDialog';
import type {BoardDialogMode, BoardDialogResult} from '../BoardDialog';
import TemplatesGallery from '../TemplatesGallery';
import Settings from '../Settings';
import FeedbackDialog from '../FeedbackDialog';
import ExportModal from '../ExportModal';
import type {ThemeName} from '../theme';

type ModalMountsProps = {
  /* ---- BoardDialog ---- */
  boardDlg: BoardDialogMode | null;
  curBoardName: string;
  onCancelBoardDlg: () => void;
  onSubmitBoardDlg: (r: BoardDialogResult) => void;
  /** both the dialog and the gallery return focus here (App's boardsMenuBtnRef). */
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
  nextUntitledName: string;
  /** stashes the typed name, closes the dialog, opens the gallery (ROUND 6, ITEM 3). */
  onBrowseTemplates: (name: string) => void;
  /* ---- TemplatesGallery ---- */
  tgOpen: boolean;
  onCloseGallery: () => void;
  onUseTemplate: (id: string) => void;
  /* ---- Settings (the pane props, verbatim from App's mount) ---- */
  settingsOpen: boolean;
  onCloseSettings: () => void;
  settingsProps: Omit<React.ComponentProps<typeof Settings>, 'open' | 'onClose'>;
  /* ---- FeedbackDialog ---- */
  feedbackOpen: boolean;
  onCloseFeedback: () => void;
  feedbackReturn: React.RefObject<HTMLElement | null>;
  boardPng: (() => Promise<string>) | null;
  /* ---- ExportModal ---- */
  expOpen: boolean;
  onCloseExport: () => void;
  nodes: Node[];
  edges: Edge[];
  liveTheme: ThemeName;
  boardName: string | undefined;
  selCount: number;
  buildSvg: React.ComponentProps<typeof ExportModal>['buildSvg'];
  buildPng: React.ComponentProps<typeof ExportModal>['buildPng'];
  printPdf: React.ComponentProps<typeof ExportModal>['printPdf'];
  /* ---- the hidden JSON import input ---- */
  fileRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: React.ChangeEventHandler<HTMLInputElement>;
};

/** The five top-level overlays, in their original mount order. */
export function ModalMounts(p: ModalMountsProps) {
  return <>
        {/* ITEM 6b: the designed board dialog — create / rename / delete. Inside
            `.canvas-wrap` beside the search palette and Settings, so its scrim
            covers the canvas column and the two docked panels stay legible.
            ROUND 6, ITEM 3 — the typed name is STASHED by `onBrowseTemplates`
            before the gallery opens, and consumed by `useTemplate` when a card
            is picked (the defect lived on this line: it dropped the name, so
            `createFromTemplate` auto-numbered). */}
        {p.boardDlg && (
          <BoardDialog
            mode={p.boardDlg}
            boardName={p.curBoardName}
            onCancel={p.onCancelBoardDlg}
            onSubmit={p.onSubmitBoardDlg}
            returnFocusTo={p.returnFocusTo}
            defaultName={p.nextUntitledName}
            onBrowse={p.onBrowseTemplates}
          />
        )}

        {/* PACKAGE-TEMPLATES §2.5 Pass 2 — the gallery. Inside `.canvas-wrap`
            beside the board dialog and Settings, so its scrim covers the canvas
            column and the two docked panels stay legible. Mounted AFTER the
            dialog, and above it via `.tg-overlay`'s z-index: the dialog is never
            visible through the gallery — the open gallery's scrim covers it —
            and the dialog is unmounted (not hidden) whenever the gallery is
            opened from the boards menu, so exactly one of the two creates the
            board and the other cannot be clicked behind a scrim. */}
        {p.tgOpen && (
          <TemplatesGallery
            onCancel={p.onCloseGallery}
            onUse={p.onUseTemplate}
            returnFocusTo={p.returnFocusTo}
          />
        )}

        {/* M2: the Settings dialog — inside .canvas-wrap, so the scrim covers
            the canvas column only (the palette and inspector stay live). */}
        <Settings
          open={p.settingsOpen}
          onClose={p.onCloseSettings}
          {...p.settingsProps}
        />

        {/* ROUND BI, ITEM 3 — the app's ONE feedback dialog (see App's import
            and state). Rendered here, inside `.canvas-wrap` beside Settings, so
            its scrim covers the canvas column like every other modal;
            `.fb-overlay`'s z-index (80) keeps it above the Settings modal (70)
            and the help sheet (30) whichever opener started it. */}
        {p.feedbackOpen && (
          <FeedbackDialog
            onCancel={p.onCloseFeedback}
            returnFocusTo={p.feedbackReturn}
            boardPng={p.boardPng}
          />
        )}

        <input
          ref={p.fileRef}
          type="file"
          accept="application/json,.json"
          style={{display: 'none'}}
          onChange={p.onImportFile}
        />

        <ExportModal
          open={p.expOpen}
          onClose={p.onCloseExport}
          nodes={p.nodes}
          edges={p.edges}
          liveTheme={p.liveTheme}
          boardName={p.boardName}
          selCount={p.selCount}
          buildSvg={p.buildSvg}
          buildPng={p.buildPng}
          printPdf={p.printPdf}
          onImportJson={() => p.fileRef.current?.click()}
        />
  </>;
}
