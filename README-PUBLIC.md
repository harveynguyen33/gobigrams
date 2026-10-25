# Gobigrams

Draw diagrams in your browser — flowcharts, architecture and data-model diagrams —
with a **real vector export** (selectable text, not a screenshot).

Gobigrams is a single-page React app built on [React Flow](https://reactflow.dev).
There is no backend: boards live in your browser, and the app runs from any static
host or even `file://`-style local serving.

> Status: v0.1.0, pre-1.0. The editor is feature-complete enough to be used daily;
> expect rough edges around import of foreign formats.

## What it does

- **Canvas** — 60+ shapes across Basic, Flowchart, Data & storage, Architecture and
  Groups, plus custom SVG shapes you can drop in yourself.
- **Edges that carry meaning** — solid / dashed / animated strokes, start and end
  markers, cardinality for ERD-style links, labels that live on the line.
- **Themes** — Dark, Light, Paper, Midnight and a high-contrast theme, plus per-element
  authored colours that survive a theme switch.
- **Boards** — named documents with autosave. Export any board as SVG (vector, with
  real `<text>`), PNG, PDF or JSON; import JSON back in one undo step.
- **Mermaid import** — paste Mermaid `flowchart` source and get nodes on the canvas.
- **Keyboard-first** — full shortcut sheet in the **?** menu, nudge, duplicate,
  align/distribute, auto-layout.
- **A tour** — first visit runs a short guided tour; replay it any time from **?**

## Requirements

- Node.js 20+ (tested on 20.20 and 22.23)
- A modern browser (Chrome, Firefox, Safari or Edge)

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Build a static bundle:

```bash
npm run build        # -> dist/
npm run preview      # serve the built bundle locally
```

`dist/` is fully static — put it behind any web server or CDN. The app detects at boot
whether a board API is available: with one it persists server-side, without one it
persists in the browser (IndexedDB) and says so plainly.

## How your data is stored

Boards are stored **in your browser** by default. Nothing is uploaded anywhere.
Export as JSON to keep a durable copy or to move a board between machines.

## Feedback

Found a bug, or want a shape or tool that isn't there? Use **Send feedback** in the
**?** menu — it writes your note into a prefilled GitHub issue (with an optional
screenshot you can paste in) so nothing gets lost in a chat thread.

## Project layout

The editor is decomposed along real seams: a thin composition root, domain hooks,
and per-family module directories.

| Path | What it is |
| --- | --- |
| `src/App.tsx` | Composition root — wires the domain hooks together |
| `src/use*.ts` | Domain hooks: undo history, persistence, connections, canvas tools, boards menu, export actions |
| `src/edges/` | The edge family — one live edge component, edge data, flow payloads, registry |
| `src/presets/` | Shape presets by category, re-exported as one union |
| `src/settings/` | Settings panes and controls |
| `src/pickers/` | Inspector pickers (popovers, rows, sections) |
| `src/components/` | Shared chrome — toolbar, help sheet, modal mounts, empty panel |
| `src/*Node.tsx`, `src/nodes/TableNode.tsx`, … | Node renderers (terminal, process, table, label, custom SVG…) |
| `src/boards.ts`, `src/localStore.ts`, `src/boardMigrations.ts` | Board storage: data layer, IndexedDB fallback, on-read migrations |
| `src/export*.ts`, `src/export/printView.ts` | The lazy export cluster — SVG / PNG / PDF / scene assembly |
| `src/FeedbackDialog.tsx`, `src/feedbackIssueUrl.ts`, `src/boardClipboard.ts` | Token-free feedback: prefilled GitHub issue + clipboard PNG |
| `public/` | Static assets served as-is (brand marks, favicons, manifest) |
| `index.html` | Vite entry point |
| `vite.config.ts` | Build config, including the optional board-API proxy |

## Tech

React 19 · TypeScript · Vite · [@xyflow/react](https://reactflow.dev) (MIT) ·
lucide-react icons · harfbuzzjs (used for text measurement so canvas and export agree).

## Author

[Harvey Nguyen](mailto:harvey.nguyen33@gmail.com) — [source](https://github.com/harveynguyen33/gobigrams).
The same email signs every commit, the LICENSE, CODEOWNERS and the in-app About pane.

## License

MIT — see [LICENSE](./LICENSE).
