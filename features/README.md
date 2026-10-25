# Features

Every user-facing feature and its module home. After the BN decomposition (2026-10-25)
entry paths point at hooks/components/directories — the composition root is App.tsx.

- [canvas-editor](./canvas-editor.md) — the React Flow canvas: nodes, edges, labels, animation, inspector (App + useConnections/useCanvasTools/useUndoHistory + src/edges/)
- [edges](./edges.md) — the edge family: one live component, five type ids, labels, bends, payload flow (src/edges/)
- [boards](./boards.md) — named boards: save, load, autosave, delete, share-safe defaults (useBoardsMenu + usePersistence)
- [persistence](./persistence.md) — where boards live: server API or IndexedDB, migrations on read, storage-mode honesty (usePersistence + boards.ts + localStore.ts)
- [export](./export.md) — real vector SVG/PNG/PDF/JSON export + Mermaid import, as a lazy chunk (useExportActions + the export cluster)
- [feedback](./feedback.md) — in-app reporting without a backend: prefilled GitHub issue + clipboard PNG (FeedbackDialog + feedbackIssueUrl + boardClipboard)
- [appearance](./appearance.md) — themes, the Appearance pane, per-element authored colours (src/settings/ + ThemePicker + tokens)

*Coverage note*

The seven files above cover every user-facing FEATURE. The 50-odd remaining modules are
plumbing under those umbrellas (palette search, helper lines, table/label nodes, the
export modal, font manifest, mermaid parser, touch handling...). They are reachable from
each feature's entry_paths via imports; the file-size-gate harness is the authoritative
per-file inventory (checks/file-size-gate.mjs prints the full table).
