---
feature: persistence
entry_paths:
  - src/usePersistence.ts
  - src/useBoardsMenu.ts
  - src/boards.ts
  - src/localStore.ts
  - src/boardMigrations.ts
  - src/storageMode.ts
verified: never-driven (created 2026-10-25, ROUND BN-4 Phase D)
---
# persistence

Where boards live: server-side when a board API answers, browser IndexedDB when it does
not (the boot probe decides, and the UI says which). Autosave is gated by canAutosave;
older boards are migrated on read, never on write.

## Sub-features

The feature's module homes and their roles:

- `src/usePersistence.ts` — saveState, autosave effect, flushSave, canAutosave (AS-5),
  the AT-1 storage-mode + AT-4 quota readouts, first-run bootstrap
- `src/useBoardsMenu.ts` — the boards menu + dialogs (create/rename/delete/duplicate)
- `src/boards.ts` — the data layer (list/get/put/delete, storage-mode probe)
- `src/localStore.ts` — the IndexedDB fallback
- `src/boardMigrations.ts` — on-read migrations (handle remap, animated folding,
  flow:'event' folding, label folding, __editAt folding)
- `src/storageMode.ts` — the probe leaf (so library.ts's esbuild cone stays @xyflow-free)

## How to get to it (user POV)

Reach the feature from the app surface (Export menu, ? sheet → Send feedback, Boards menu / reload).

- Migrations run ON READ; stored files are never rewritten just by opening.
- Storage keys stay `diagram-studio:*` forever (renaming would wipe users' boards).
- The last-board pointer restores the session across reloads (StrictMode-guarded).

## Driving it with harness

round-at-local-store, round-as-boards-put, round-as-import-history (import = ONE undo
entry), boot-no-flash, package-templates (create paths).

## Gotchas

- See the file links above; every invariant is pinned by the named harnesses.

