<p align="center"><img src="https://raw.githubusercontent.com/harveynguyen33/gobigrams/main/public/brand/lockup.svg" alt="Gobigrams" width="320"></p>
<p align="center"><sub>{ G }</sub> — a tiny goblin with a ruler, living in your browser tab.</p>

# Gobigrams

Diagrams, but with a goblin. **Gobigrams** is a single-page canvas where boxes
finally line up, arrows mean things, and the SVG you export is a *real vector
file with selectable text* — not a screenshot wearing a vector hat.

No account. No backend. No "please accept cookies" banner. The goblin counts
visitors with a cookieless, self-hosted tally counter and otherwise keeps his
nose out of your business. Your boards live in your browser until *you* decide
to export them.

> Status: v0.1.0 — feature-complete enough for daily use, still occasionally
> bumping into furniture. Report the bumps → [Support](./SUPPORT.md).

## The short version

- 🧌 60+ shapes, custom SVG drops, tables, checklists — enough to draw the thing
- ➡️ Edges with intent: animated flow, cardinality, labels that ride the line
- 🌗 Five themes and per-element colours that survive a theme switch
- 📤 SVG (real text) · PNG · PDF · JSON · Mermaid import
- ⌨️ Keyboard-first: nudge, duplicate, align, auto-layout, full shortcut sheet in **?**
- 🗄️ Boards with autosave; storage is honest about where it keeps your stuff

The category-by-category inventory lives in **[FEATURES.md](./FEATURES.md)**.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # -> dist/ (fully static, host it anywhere)
```

Node.js 20+ and a modern browser. `dist/` runs behind any web server or CDN,
or even `file://`-style local serving.

## How your data is stored

In **your browser** (IndexedDB), unless the app finds a board API at boot —
it probes and tells you plainly which one it found. Export JSON for a durable
copy or to move a board between machines. Nothing is uploaded by default.

## Community

- 🐛 [Report a bug or request a shape](./SUPPORT.md) — the in-app *Feedback* link prefills the issue for you
- 💬 [GitHub Discussions](https://github.com/harveynguyen33/gobigrams/discussions) — questions, show-and-tell, ideas
- 🤝 [Contributing](./CONTRIBUTING.md) — yes, it's a solo goblin, but pull requests are welcome
- 🔒 [Security](./SECURITY.md) — found something sensitive? Start here, not in a public issue

## Tech

React 19 · TypeScript · Vite · [React Flow](https://reactflow.dev) (MIT) ·
harfbuzzjs (canvas and export agree on text because they share a measurer).

## Author

[Harvey Nguyen](mailto:harvey.nguyen33@gmail.com) — the same email signs every
commit, the LICENSE, CODEOWNERS and the in-app About pane.

## License

MIT — see [LICENSE](./LICENSE).
