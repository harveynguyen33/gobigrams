---
feature: boards
entry_paths:
  - src/boards.ts
  - src/dialogs/BoardDialog.tsx
  - src/useBoardsMenu.ts
  - src/usePersistence.ts
  - src/boardMigrations.ts
  - src/components/ModalMounts.tsx
verified: never-driven (2026-10-12; homes re-pointed 2026-10-25, ROUND BN-4 Phase D)
---
# boards

Named, persistent diagrams. The user saves the current canvas under a name, reopens it
later from the board dialog, and the app autosaves so a refresh never loses work.

## Sub-features

- save / save-as with a name; board list dialog with open + delete
- autosave on change (debounced) with reconnect on reload
- localStorage-backed; boards/ directory ships demo content

## How to get to it (user POV)

- Click the board name in the top bar (or press the boards shortcut) — the dialog lists
  saved boards; pick one to load it.

## Driving it with harness

Preconditions: dev server running; a browser harness with localStorage access.

**Save + reload.** `checks/package-o-board-dialog.harness.mjs` drives the dialog end to
end: create a board, save, reload the page, assert the board reopens with the same graph.

## Gotchas

- Stale persisted UI state is CLEARED + re-initialised, never migrated (house rule).
- The demo board `boards/mu01q1ue3a854b81.json` must stay byte-identical — round harnesses
  restore it after mutating tests.


*Module homes (after the BN decomposition)*

- `src/useBoardsMenu.ts` — board dialog state, create-from-template + gallery handover,
  rename/duplicate/delete, popover clamp, openBoard
- `src/usePersistence.ts` — save/load/autosave/canAutosave, storage-mode + quota readouts,
  first-run bootstrap (last-board restore)
- `src/boardMigrations.ts` — the on-read migrations (edge handle remap, animated-flag
  folding, flow:'event' folding, label folding, __editAt folding)
- `src/components/ModalMounts.tsx` — where the BoardDialog + TemplatesGallery mount
- `src/boards.ts` — the data layer itself (unchanged)
