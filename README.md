# Diagram Studio

A node-based diagram editor for architecture drawings. Dark theme, keyboard-friendly,
built on [React Flow](https://reactflow.dev) (MIT).

## Requirements

- Node.js 20+ (tested on 20.20 and 22.23)
- npm
- A modern browser (Chrome / Firefox / Safari / Edge)

## Get started

```bash
git clone <this-repo>            # or copy the folder
cd diagram-studio
npm install
npm run dev                      # starts on http://localhost:5173
```

Open the printed URL. Nothing else is required — boards are stored as local JSON files.

**First time?** A short guided tour runs automatically — it walks you through the board menu,
the shape palette, the canvas, the toolbar, the inspector, edges and the help sheet. Skip it
any time, or replay it later from the **?** menu (**Take a tour**). A “Getting started”
checklist in the corner ticks itself off as you create a node, connect two nodes, rename an
arrow, move something, export, and create your own board.

### Running on a different machine (e.g. from another computer on your LAN)

```bash
npx vite --host 0.0.0.0 --port 5200 --strictPort
# then open http://<your-machine-ip>:5200/
```

`localhost` only works on the same machine; use the LAN IP from other devices.

## Where your drawings are stored

Each board is one JSON file in `./boards/<id>.json`. The folder is created on first
run and is git-ignored, so your diagrams stay local. Back it up by copying the folder.

## Concepts

**Board** — one drawing. Create as many as you like; switch with the board menu in
the top-left. Each board autosaves.

**Node** — a component. Every node has a *shape* (its architectural meaning) plus
free text fields (kicker / title / sub / metric) and a colour.

**Edge** — a connection. Edges can carry a label, an arrow head, and an optional
flow animation. A new connection is drawn as a smooth bend by default; change an
edge's curvature in the inspector and that choice becomes the default for the
connections you draw afterwards, and it is remembered the next time you open the
tool.

**Connecting two nodes** — every node has four connection points, one at the
middle of each side (left, right, top and bottom). Drag from one node to another
to connect them: the arrow points at the node you dragged **to**. Releasing the
drag over empty canvas does nothing at all — no node is created and no connection
is made, so a drag that misses its target is simply dropped.

## Shapes

| Shape | Reads as |
|---|---|
| Service | rounded rect — an application or service |
| Database | cylinder — a datastore |
| Queue | container with item rows — a queue / stream / bus |
| External | dashed rect — a third-party or external system |
| Actor | rect with a person badge — a user |
| Storage | bucket — object storage |
| Gateway | hexagon — an API gateway / load balancer |
| Group | dashed boundary — a VPC / cluster / logical grouping |
| Note / Text | plain annotation |

Any node can be re-shaped at any time from the inspector; its text is kept.

## Shape palette, favourites & custom shapes

The left panel is one scrolling column with three parts: a **search field**, your
**Favourites**, and the **shape library** — the library itself grouped into 8
collapsible categories.

**Search** — the field matches a shape's **name**, its **hint**, its **synonyms
(aliases)** and its **geometry word**, so `subproc`, `cylinder` and `diamond` each
find the right shape. A hit sitting inside a category you have collapsed is shown
**dimmed, not hidden**, so you can always see that the library has it.

**Favourites** — saved shape *references*, not copied drawings: starring a shape
adds it, and changing the theme recolours it along with everything else.

- Add the current canvas selection as a favourite with the `+` tile.
- Insert one with a click, a double-click or a drag.

**Custom shapes** — import your own `.svg` with the **Import** button, or by
dropping the file on the panel. The markup is **sanitised** (scripts, styles,
external references and embedded handlers are stripped), clamped to a sane size,
and stored **locally** next to your boards. Click or drag a tile to place it; the
`×` on a tile removes it.

- An import is rejected unless the file is an **`.svg`**, **under 512 KB**, and
  carries a **`viewBox`** with a **non-zero width/height**. The fix is to re-export
  the SVG from your editor with a viewBox and a size.

The whole palette library lives in the same local store as your boards, as a single
JSON document. There is no account and no backend.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Del` / `Backspace` | Delete selection |
| `Cmd/Ctrl + C` / `V` / `D` | Copy / paste / duplicate |
| `Esc` | Deselect |
| `Shift + 1` | Fit view to diagram |
| `Shift + 2` | Toggle read-only review mode |
| Arrow keys | Move selection 1px (hold `Shift` for 10px) |
| Double-click canvas | Insert node (searchable) |
| `/` | Focus the shape search |
| Click an edge | Edit its label, style and arrow heads |
| Drag from a node edge | Connect two nodes |
| `Cmd/Ctrl` + click | Select multiple nodes |
| Double-click an edge label | Rename the connection |
| Drag on empty canvas | Box-select |
| `Shift` + drag on empty canvas | Box-select |
| Scroll / two-finger swipe | Pan (both axes) |
| `Ctrl`/`Cmd` + scroll (trackpad pinch) | Zoom |
| `Space` + drag / middle-drag | Pan |
| `Cmd/Ctrl + Shift + \` | Collapse / expand both side panels |

The same list is available in-app behind the **?** button.

## Alignment help

Two independent helpers keep drawings tidy — both live in the toolbar:

- **Alignment guides** (on by default) — while you drag a node, dashed blue guides appear
  when its edges or centre line up with another node, and the node snaps to them on release.
  Turn it off if you prefer to place nodes by hand.
- **Snap to grid** — rounds positions to a 16px grid.

## Read-only review

The **Eye** button in the toolbar (next to Fit view, Alignment guides and Snap) switches the
canvas to review mode: a way to read a whole diagram without disturbing it. `Shift + 2` toggles
the same mode from the keyboard.

- You can still move around freely — a left-drag anywhere on the canvas pans it, as do
  scrolling, a middle-drag and a trackpad.
- Nothing can be selected, moved, resized, connected or deleted. The insert palette and the
  right-click menus do not open, and undo, redo, copy, paste, duplicate, nudge and Delete
  do nothing.
- Turn it on and the current selection is cleared. **Fit view** (`Shift + 1`), `Esc` and `?`
  still work, because they only change what you are looking at.
- The button remembers its state, so the tool reopens in the mode you left it in. It is off
  until you switch it on.

## Exporting

**Export ▾** offers:

- **Export PNG** — raster image (2×) for slides and chat.
- **Export SVG** — vector, for the web.
- **Export JSON** — the board as a file (re-importable).
- **Import JSON** — load a board file into the current board.

## Customising the look

**⚙ Settings** in the canvas toolbar opens the Settings dialog — seven categories
(Appearance, Canvas, Connections, Editor, Export, Keyboard, About) with a search box over
them. **Appearance** holds the theme **cards**: System plus Dark, Light, Paper, Midnight and
Contrast. Each card paints a miniature diagram with that theme's own colours, so you can see
what you are picking before you pick it; the checkmark marks the active one. Picking a card
applies the theme immediately, and the theme covers the canvas, the panels **and every
export** — a PNG or SVG carries the theme it was drawn in. Your choice is remembered, and
**System** follows your operating system.

Everything else in the dialog is read-only for now: the Canvas, Connections and Editor panes
show the live state of controls that still live on the toolbar, and the Export pane lists the
four real export actions.

Under the hood, all colours and surfaces come from CSS custom properties at the top of
`src/styles.css` (`--bg`, `--surface`, `--elevated`, `--border`, `--fg`, `--dim`,
`--acc`, `--sel`, plus the six symbolic `--c-*` shape accents). Each theme is one
`[data-theme="…"]` block, so adding a theme is a token block and a card — no component
changes. Change a token there and the whole UI follows.

## Development

```bash
npm run dev        # dev server with hot reload
npx tsc --noEmit   # type check
npx vite build     # production build → dist/
```

Source layout:

```
src/
├── App.tsx           # shell: toolbar, panels, canvas, inspectors, shortcuts, history
├── Settings.tsx      # the Settings dialog (nav + 7 panes, theme lives here)
├── ThemePicker.tsx   # the theme cards + the scoped token probe
├── DiagramNode.tsx   # the node renderer (shape + icon + resize)
├── CustomShapeNode.tsx # imported-SVG node renderer
├── GoblinEdge.tsx    # the edge renderer (curvature, label, flow animation)
├── LabelNode.tsx     # free-text node
├── SearchPalette.tsx # insert-node search (double-click canvas)
├── IconPicker.tsx    # searchable icon picker
├── Tooltip.tsx       # tooltip wrapper
├── boards.ts         # board persistence client
├── library.ts        # the palette library client (.favourites / .shapes)
├── categoryState.ts  # persisted category fold state
├── shapes.tsx        # the architectural shapes
├── customShape.ts    # SVG import: sanitise + size clamps
├── palette.ts        # palette presets + colours
├── lucideIcons.ts    # icon registry
└── styles.css        # design tokens + styles
```

Boards API (dev middleware in `vite.config.ts`): `GET/POST /api/boards`,
`GET/PUT/DELETE /api/boards/:id`.

## License

MIT (React Flow is MIT; check its licence for your own use).
